// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

interface IExtendedResolver {
    function resolve(bytes calldata name, bytes calldata data) external view returns (bytes memory);
}

interface ISupportsInterface {
    function supportsInterface(bytes4 interfaceID) external pure returns (bool);
}

/**
 * @title OffchainResolver
 * @notice EIP-3668 CCIP-Read resolver for bankrclub.eth subdomains.
 *         Handles wildcard subdomain resolution (alice.bankrclub.eth → address)
 *         via offchain gateway, plus contenthash storage for the root domain.
 */
contract OffchainResolver is IExtendedResolver, ISupportsInterface {
    string public url;
    address public owner;
    address public signer;

    mapping(bytes32 => bytes) private _contenthashes;
    mapping(bytes32 => address) private _addresses;

    error OffchainLookup(
        address sender,
        string[] urls,
        bytes callData,
        bytes4 callbackFunction,
        bytes extraData
    );

    event SignerUpdated(address indexed newSigner);
    event UrlUpdated(string newUrl);
    event ContenthashUpdated(bytes32 indexed node, bytes contenthash);
    event OwnershipTransferred(address indexed newOwner);

    constructor(string memory _url, address _signer) {
        url = _url;
        signer = _signer;
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    function setSigner(address _signer) external onlyOwner {
        signer = _signer;
        emit SignerUpdated(_signer);
    }

    function setUrl(string calldata _url) external onlyOwner {
        url = _url;
        emit UrlUpdated(_url);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        owner = newOwner;
        emit OwnershipTransferred(newOwner);
    }

    // ── Contenthash (for bankrclub.eth.limo website hosting) ──────────────

    function setContenthash(bytes32 node, bytes calldata hash) external onlyOwner {
        _contenthashes[node] = hash;
        emit ContenthashUpdated(node, hash);
    }

    function contenthash(bytes32 node) external view returns (bytes memory) {
        return _contenthashes[node];
    }

    // ── CCIP-Read (for alice.bankrclub.eth → address resolution) ──────────

    function resolve(bytes calldata name, bytes calldata data)
        external view override returns (bytes memory)
    {
        string[] memory urls = new string[](1);
        urls[0] = string(abi.encodePacked(url, "/{sender}/{data}"));
        revert OffchainLookup(
            address(this),
            urls,
            data,
            OffchainResolver.resolveWithProof.selector,
            abi.encode(name, data)
        );
    }

    function resolveWithProof(bytes calldata response, bytes calldata extraData)
        external view returns (bytes memory)
    {
        (bytes memory result, uint64 validUntil, bytes memory sig) =
            abi.decode(response, (bytes, uint64, bytes));

        require(validUntil >= block.timestamp, "response expired");

        bytes32 messageHash = keccak256(
            abi.encodePacked(
                hex"1900",
                address(this),
                validUntil,
                keccak256(extraData),
                keccak256(result)
            )
        );
        bytes32 ethHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash)
        );
        address recovered = recoverSigner(ethHash, sig);
        require(recovered == signer, "invalid signature");
        return result;
    }

    // ── Interface support ─────────────────────────────────────────────────

    function supportsInterface(bytes4 interfaceID)
        external pure override returns (bool)
    {
        return
            interfaceID == type(IExtendedResolver).interfaceId ||  // 0x9061b923
            interfaceID == type(ISupportsInterface).interfaceId || // 0x01ffc9a7
            interfaceID == 0xbc1c58d1 || // contenthash(bytes32)
            interfaceID == 0x3b3b57de;   // addr(bytes32)
    }

    // ── Internal ──────────────────────────────────────────────────────────

    function recoverSigner(bytes32 hash, bytes memory sig)
        internal pure returns (address)
    {
        require(sig.length == 65, "invalid sig length");
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }
        if (v < 27) v += 27;
        return ecrecover(hash, v, r, s);
    }
}
