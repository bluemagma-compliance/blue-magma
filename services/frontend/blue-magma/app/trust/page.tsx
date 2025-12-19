import { getCommitmentPreview } from "./actions";
import { TrustCenterClient } from "./trust-center-client";

export default async function TrustCenterPage() {
	  const preview = await getCommitmentPreview();

	  return <TrustCenterClient initialPreview={preview} />;
}
