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
 *         Resolves subdomains by querying the offchain gateway (Next.js API).
 */
contract OffchainResolver is IExtendedResolver, ISupportsInterface {
    string public url;
    address public owner;
    address public signer;

    error OffchainLookup(
        address sender,
        string[] urls,
        bytes callData,
        bytes4 callbackFunction,
        bytes extraData
    );

    event SignerUpdated(address indexed newSigner);
    event UrlUpdated(string newUrl);

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
    }

    function resolve(bytes calldata name, bytes calldata data)
        external
        view
        override
        returns (bytes memory)
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
        external
        view
        returns (bytes memory)
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

    function supportsInterface(bytes4 interfaceID) external pure override returns (bool) {
        return
            interfaceID == type(IExtendedResolver).interfaceId ||
            interfaceID == type(ISupportsInterface).interfaceId;
    }

    function recoverSigner(bytes32 hash, bytes memory sig) internal pure returns (address) {
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
