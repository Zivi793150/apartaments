import dynamic from "next/dynamic";

const SpainBuildingClient = dynamic(() => import("./client"), { ssr: false });

export default function BuildingSpainPage() {
  return <SpainBuildingClient />;
}
