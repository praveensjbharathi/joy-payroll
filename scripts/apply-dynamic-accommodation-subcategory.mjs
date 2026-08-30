import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

// 1) Hostel Master doubles as the sub-category master.
//    For Outside Room accommodation, the same master is shown as Area Master.
const hostelPath = join(root, "app/hostel-master.tsx");
let hostel = await readFile(hostelPath, "utf8");
hostel = hostel.replace(
  'const placeLabel = isOutsideRoom ? "Local area" : "Hostel";',
  'const placeLabel = isOutsideRoom ? "Area" : "Hostel";',
);
hostel = hostel.replaceAll("Stored local areas", "Stored areas");
await writeFile(hostelPath, hostel, "utf8");

// 2) Recovery must read Accommodation Category directly from Operational Master,
//    then show the matching sub-category created in Hostel/Area Master.
const recoveryPath = join(root, "app/reports-recovery.tsx");
let recovery = await readFile(recoveryPath, "utf8");

recovery = recovery.replace(
  'const [roomRecoveryScope, setRoomRecoveryScope] = useState<"" | "joy" | "outside">("");',
  'const [roomRecoveryScope, setRoomRecoveryScope] = useState("");',
);

recovery = recovery.replace(
  /  const joyRecoveryTypeIds = data\.accommodationTypes[\s\S]*?  const existingRecoveryRoomMembers = employees\.filter\(\(employee\) => employee\.roomId === roomRecoveryId\);/,
  `  const recoveryAccommodationTypes = data.accommodationTypes.filter((type) => type.status === "active");
  const selectedRecoveryType = recoveryAccommodationTypes.find((type) => type.id === roomRecoveryScope);
  const isOutsideRecoveryType = selectedRecoveryType?.name.toLowerCase().includes("outside") ?? false;
  const recoveryHostels = data.hostels.filter(
    (hostel) =>
      hostel.status === "active" &&
      hostel.accommodationTypeId === roomRecoveryScope,
  );
  const recoveryRooms = data.accommodationRooms.filter((room) => {
    if (room.status !== "active" || room.accommodationTypeId !== roomRecoveryScope) return false;
    if (!roomRecoveryHostelId) return false;
    return room.hostelId === roomRecoveryHostelId;
  });
  const selectedRecoveryRoom = data.accommodationRooms.find((room) => room.id === roomRecoveryId);
  const existingRecoveryRoomMembers = employees.filter((employee) => employee.roomId === roomRecoveryId);`,
);

recovery = recovery.replace(
  /<select value=\{roomRecoveryScope\} onChange=\{\(event\) => \{[\s\S]*?<option value="outside">Outside Room<\/option>\n            <\/select>/,
  `<select value={roomRecoveryScope} onChange={(event) => {
              setRoomRecoveryScope(event.target.value);
              setRoomRecoveryHostelId("");
              setRoomRecoveryArea("");
              chooseRecoveryRoom("");
            }}>
              <option value="">Select category</option>
              {recoveryAccommodationTypes.map((type) => (
                <option key={type.id} value={type.id}>{type.name}</option>
              ))}
            </select>`,
);

recovery = recovery.replace(
  /\{roomRecoveryScope === "joy" \? \([\s\S]*?\) : null\}\n          \{roomRecoveryScope === "outside" \? \([\s\S]*?\) : null\}/,
  `{roomRecoveryScope ? (
            <label>
              <span>Sub category / {isOutsideRecoveryType ? "Area name" : "Hostel name"} *</span>
              <select value={roomRecoveryHostelId} onChange={(event) => {
                setRoomRecoveryHostelId(event.target.value);
                chooseRecoveryRoom("");
              }}>
                <option value="">Select {isOutsideRecoveryType ? "area" : "hostel"}</option>
                {recoveryHostels.map((hostel) => (
                  <option key={hostel.id} value={hostel.id}>{hostel.name}</option>
                ))}
              </select>
            </label>
          ) : null}`,
);

recovery = recovery.replace(
  'disabled={!roomRecoveryScope}',
  'disabled={!roomRecoveryScope || !roomRecoveryHostelId}',
);

await writeFile(recoveryPath, recovery, "utf8");
console.log("Dynamic accommodation category/sub-category applied: Operational Master type -> Hostel/Area Master sub-category -> Room.");
