# Joy Payroll attendance capture

Open **Attendance Capture** and choose the group company and client unit. HR and payroll permissions and company/unit assignments apply on the server. Hostel-only accounts do not have device capture access. Super Admin registers devices, manages keys and maps terminal user IDs.

## Capture and shift flow

1. **QR:** HR scans an existing employee ID card using the camera, a QR photo or a USB scanner. Verify the employee-master photo and name, then confirm the capture. The QR is an identity lookup, not a login credential.
2. **Biometric:** The terminal matches its enrolled fingerprint or face. Its gateway sends punch metadata to the secured receiver, or HR imports its CSV log. Templates, fingerprints and face images stay on the terminal.
3. The first valid capture is **IN**. A second capture within **10 minutes** is ignored and does not advance the punch state. The next accepted capture is **OUT**. The same lock applies after OUT. Checks are serialized per employee across QR and devices.
4. Regular employees use their configured default shift. Rotational employees use the closest start time among their employee-master shifts (including the default). Ties prefer the default. OUT retains the IN shift. India time (Asia/Kolkata) is used for attendance dates.
5. HR reviews the paired punches. Worked time uses the configured break without deducting an already clocked-out break twice. The shift determines suggested OT and timing deductions; HR approves the status and OT. Overnight work belongs to the IN workday.
6. A missing OUT after 24 hours remains an exception; the next day's capture starts a new IN. Missing or out-of-order punches need an audited HR correction. Incorrect pending punches may be ignored with a reason. Posted punches are retained.
7. Posting creates the system daily attendance used by Revenue Projection and payroll recalculation. Existing attendance requires explicit replacement and a reason. Approved payroll and downloaded payment batches stay locked.

## Monthly salary confirmation

In **Payroll Run → Month-end attendance confirmation**:

- Review system days and OT against the client file.
- Use **Bulk upload client records**. Existing Excel, CSV and TXT import formats remain available. The factory-attendance checkbox stores daily client records separately; it does not overwrite system attendance. Import each employee's whole payroll period, including A, WO and H for non-working dates. Uploads for custom periods may require more than one calendar-month file.
- Choose **System attendance**, **Client uploaded attendance**, or **Client uploaded salary register**, according to the payroll mode.
- Review missing days and differences, enter the final review note and confirm. Client daily attendance must cover every payroll employee's employment dates in the period. Resolve pending punches before confirming system attendance.
- Confirmation recalculates draft salary. Salary approval also recalculates the selected source and requires current final confirmation. New attendance, later punches, client corrections, payroll employee changes, period changes or reopening invalidate the relevant confirmation.
- The comparison can be exported to CSV. Raw punches can be exported from Punch review. Existing payroll and attendance reports remain available.

## Terminal gateway connection

The device brand/model determines the vendor-specific gateway. This API is not a claim of native compatibility with every terminal or ADMS protocol. Until the gateway is configured, use CSV import.

1. Super Admin registers a device for one client unit and copies the one-time key. Only its SHA-256 hash is stored. Rotating the key immediately disables the previous key; disabling the device blocks ingestion.
2. Map each terminal user ID to an employee in that unit. Preserve leading zeros. Use a new terminal ID for a different employee so historical identity remains intact.
3. Gateway sends HTTPS POST requests to:

```text
https://<project>.supabase.co/functions/v1/attendance-device
```

Headers:

```text
Content-Type: application/json
x-joy-device-key: <device-id>.<one-time-secret>
```

Body (1–500 events, maximum 250 KB; oldest first):

```json
{
  "events": [
    {"deviceUserId": "0012", "punchedAt": "2026-09-12T09:00:00+05:30", "eventId": "terminal-event-123"},
    {"deviceUserId": "0012", "punchedAt": "2026-09-12T18:00:00+05:30", "eventId": "terminal-event-124"}
  ]
}
```

Direction may be omitted. If the terminal supplies `in`, `out` or `auto`, Joy Payroll still determines the accepted sequence with the 10-minute lock. Times must have a UTC offset and be within the last 90 days, with at most five minutes of clock skew into the future.

Success returns `inserted`, `duplicates` (including captures ignored by the lock), and `rejected` with one-based data-row numbers. HTTP 207 indicates row rejections. Correct rejected rows before retrying. Identical events are idempotent; reusing an event ID for a different punch is rejected. Older events arriving after a newer accepted punch require HR correction, because inserting them could change the IN/OUT sequence.

For CSV import, use `device_user_id,punched_at,event_id`. `event_id` is optional. Direction columns can be validated using IN/OUT, 0/1 or 1/2 encodings. Local CSV timestamps use `YYYY-MM-DD HH:mm:ss` in India time; ISO timestamps with explicit offsets are also accepted.

## Performance and verification

Routine mutations return only affected collections, preserving other screen data. Scope-only employee reads omit photos and application documents. Login timestamps are refreshed at most every five minutes when the name is unchanged. Capture refreshes reuse employee/device metadata; individual QR submissions fetch one employee. Biometric batches use one database RPC; client daily imports use bulk inserts. The established single-connection transaction pool remains unchanged.

API responses expose write and refresh timings through `Server-Timing`. These changes reduce avoidable screen reload work; they do not guarantee a one-second network round trip, bulk import or payroll calculation on every device.

Run calculation/access regressions with `node --import tsx --test tests/attendance-capture.test.mjs`. `tests/attendance-capture.database.sql` tests live SQL guards inside a transaction and rolls its synthetic records back. No physical terminal was connected during these checks.
