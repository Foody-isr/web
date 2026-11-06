import {
  appleWalletGet,
  downloadAppleWallet,
} from "@/lib/server/loyalty-wallet-proxy";
export const dynamic = "force-dynamic";
export const POST = downloadAppleWallet;
export const GET = appleWalletGet;
