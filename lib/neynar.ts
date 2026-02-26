// Fire-and-forget cast when a new bankrclub.eth subdomain is registered
// POST https://api.neynar.com/v2/farcaster/cast
// Auth: x-api-key header

export async function announceRegistration(
  subdomain: string,
  address: string,
  isAgent = false,
): Promise<void> {
  const apiKey = process.env.NEYNAR_API_KEY;
  const signerUuid = process.env.FARCASTER_SIGNER_UUID;
  if (!apiKey || !signerUuid) return;

  const emoji = isAgent ? '🤖' : '🐚';
  const memberNumber = Math.floor(Math.random() * 1000) + 1;
  const text = `${emoji} ${subdomain}.bankrclub.eth just claimed their ENS subdomain on bankrclub.eth.limo — BankrClub member #${memberNumber}`;

  await fetch('https://api.neynar.com/v2/farcaster/cast', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({
      signer_uuid: signerUuid,
      text,
      channel_id: 'bankr',
    }),
  }).catch(() => {}); // fire and forget — never block registration on cast
}
