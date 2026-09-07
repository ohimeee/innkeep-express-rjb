import { InfoBar } from "../components/InfoBar";
import { RoomList } from "../components/RoomList";

export const CatalogPage: React.FC = () => {
  return (
    <div className="flex-col">
      <div className="border-b-2 py-5">
        <p className="text-xs font-medium text-orange-500">BOUTIQUE STAYS</p>
        <h1 className="text-4xl font-bold">Rooms &amp; suites</h1>
      </div>

      <InfoBar />

      <RoomList />
    </div>
  );
};
