package com.example.joypayroll.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.sqlite.db.SupportSQLiteDatabase
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

@Database(
    entities = [
        VendorEntity::class,
        ClientUnitEntity::class,
        EmployeeEntity::class,
        PayrollRecordEntity::class,
        HostelEntity::class,
        RoomEntity::class,
        RoomRecoveryEntity::class,
        PaymentBatchEntity::class
    ],
    version = 1,
    exportSchema = false
)
abstract class JoyPayrollDatabase : RoomDatabase() {
    abstract fun payrollDao(): JoyPayrollDao

    companion object {
        @Volatile
        private var INSTANCE: JoyPayrollDatabase? = null

        fun getDatabase(context: Context, scope: CoroutineScope): JoyPayrollDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    JoyPayrollDatabase::class.java,
                    "joy_payroll_database"
                )
                    .addCallback(JoyDatabaseCallback(scope))
                    .build()
                INSTANCE = instance
                instance
            }
        }

        private class JoyDatabaseCallback(
            private val scope: CoroutineScope
        ) : RoomDatabase.Callback() {
            override fun onCreate(db: SupportSQLiteDatabase) {
                super.onCreate(db)
                INSTANCE?.let { database ->
                    scope.launch(Dispatchers.IO) {
                        populateInitialData(database.payrollDao())
                    }
                }
            }

            suspend fun populateInitialData(dao: JoyPayrollDao) {
                // Seed Vendors
                val vendors = listOf(
                    VendorEntity(
                        id = "v-jcs",
                        code = "JCS",
                        name = "Joy Corporate Solutions",
                        legalName = "Joy Corporate Solutions Private Limited",
                        epfCode = "TN/MAS/0045231/000",
                        esiCode = "51000892340001001",
                        gstin = "33AAACJ1234F1Z5",
                        status = "ACTIVE"
                    ),
                    VendorEntity(
                        id = "v-jms",
                        code = "JMS",
                        name = "Joy Manpower Service",
                        legalName = "Joy Manpower Service LLP",
                        epfCode = "TN/MAS/0078192/000",
                        esiCode = "51000894560001001",
                        gstin = "33AABFJ5678K1Z2",
                        status = "ACTIVE"
                    )
                )
                dao.insertVendors(vendors)

                // Seed Hostels
                val hostels = listOf(
                    HostelEntity(
                        id = "h-1",
                        name = "Joy Grand Residence",
                        areaLocation = "Guindy Industrial Area, Chennai",
                        totalRooms = 12,
                        totalBeds = 48,
                        caretakerName = "Muthu Vel",
                        caretakerMobile = "+91 98401 23456"
                    ),
                    HostelEntity(
                        id = "h-2",
                        name = "Joy Elite Men's Hostel",
                        areaLocation = "Ambattur Estate, Chennai",
                        totalRooms = 8,
                        totalBeds = 32,
                        caretakerName = "R. Selvaraj",
                        caretakerMobile = "+91 97890 65432"
                    )
                )
                dao.insertHostels(hostels)

                // Seed Rooms
                val rooms = listOf(
                    RoomEntity("r-101", "h-1", "Joy Grand Residence", "Room 101", "1st Floor", 4, 3, 4500.0),
                    RoomEntity("r-102", "h-1", "Joy Grand Residence", "Room 102", "1st Floor", 4, 4, 4500.0),
                    RoomEntity("r-201", "h-1", "Joy Grand Residence", "Room 201", "2nd Floor", 4, 2, 4800.0),
                    RoomEntity("r-202", "h-1", "Joy Grand Residence", "Room 202", "2nd Floor", 4, 3, 4800.0),
                    RoomEntity("r-301", "h-2", "Joy Elite Men's Hostel", "Room 301", "Ground Floor", 4, 4, 4200.0),
                    RoomEntity("r-302", "h-2", "Joy Elite Men's Hostel", "Room 302", "1st Floor", 4, 3, 4200.0)
                )
                dao.insertRooms(rooms)

                // Seed Employees
                val employees = listOf(
                    EmployeeEntity(
                        id = "emp-101",
                        vendorId = "v-jcs",
                        clientUnitId = "cu-1",
                        employeeCode = "JCS-0101",
                        name = "Arun Kumar",
                        department = "Assembly Line",
                        dateOfJoining = "2024-01-15",
                        dateOfBirth = "1997-04-12",
                        mobileNumber = "+91 98765 43210",
                        emailAddress = "arunkumar@example.com",
                        bankAccountMasked = "••••••••1245",
                        bankName = "City Union Bank",
                        bankBranch = "Guindy",
                        ifscMasked = "CIUB0000123",
                        uanMasked = "1009••••7821",
                        esiMasked = "3114••••9012",
                        accommodationType = "HOSTEL",
                        roomId = "r-101",
                        roomNumber = "Room 101",
                        roomRentAmount = 1500.0,
                        bloodGroup = "O+",
                        emergencyContactNumber = "+91 94441 22334",
                        salaryAmount = 19500.0,
                        paymentMode = "BANK_TRANSFER",
                        status = "ACTIVE",
                        complianceStatus = "COMPLIANT"
                    ),
                    EmployeeEntity(
                        id = "emp-102",
                        vendorId = "v-jcs",
                        clientUnitId = "cu-1",
                        employeeCode = "JCS-0102",
                        name = "Karthik Raja",
                        department = "Quality Control",
                        dateOfJoining = "2024-02-01",
                        dateOfBirth = "1995-08-23",
                        mobileNumber = "+91 98765 43211",
                        emailAddress = "karthik.raja@example.com",
                        bankAccountMasked = "••••••••6789",
                        bankName = "State Bank of India",
                        bankBranch = "Anna Nagar",
                        ifscMasked = "SBIN0000456",
                        uanMasked = "1009••••3412",
                        esiMasked = "3114••••7789",
                        accommodationType = "HOSTEL",
                        roomId = "r-101",
                        roomNumber = "Room 101",
                        roomRentAmount = 1500.0,
                        bloodGroup = "B+",
                        emergencyContactNumber = "+91 94442 33445",
                        salaryAmount = 21000.0,
                        paymentMode = "BANK_TRANSFER",
                        status = "ACTIVE",
                        complianceStatus = "COMPLIANT"
                    ),
                    EmployeeEntity(
                        id = "emp-103",
                        vendorId = "v-jcs",
                        clientUnitId = "cu-1",
                        employeeCode = "JCS-0103",
                        name = "Suresh Babu",
                        department = "Maintenance",
                        dateOfJoining = "2023-11-10",
                        dateOfBirth = "1993-11-05",
                        mobileNumber = "+91 98765 43212",
                        emailAddress = "suresh.babu@example.com",
                        bankAccountMasked = "••••••••4321",
                        bankName = "City Union Bank",
                        bankBranch = "Guindy",
                        ifscMasked = "CIUB0000123",
                        uanMasked = "1009••••8901",
                        esiMasked = "3114••••1123",
                        accommodationType = "HOSTEL",
                        roomId = "r-101",
                        roomNumber = "Room 101",
                        roomRentAmount = 1500.0,
                        bloodGroup = "A+",
                        emergencyContactNumber = "+91 94443 44556",
                        salaryAmount = 18500.0,
                        paymentMode = "BANK_TRANSFER",
                        status = "ACTIVE",
                        complianceStatus = "COMPLIANT"
                    ),
                    EmployeeEntity(
                        id = "emp-104",
                        vendorId = "v-jms",
                        clientUnitId = "cu-2",
                        employeeCode = "JMS-0201",
                        name = "Vigneshwaran P",
                        department = "Logistics",
                        dateOfJoining = "2024-03-01",
                        dateOfBirth = "1998-02-18",
                        mobileNumber = "+91 98765 43213",
                        emailAddress = "vignesh.p@example.com",
                        bankAccountMasked = "••••••••9812",
                        bankName = "HDFC Bank",
                        bankBranch = "Ambattur",
                        ifscMasked = "HDFC0000789",
                        uanMasked = "1009••••5566",
                        esiMasked = "3114••••8899",
                        accommodationType = "HOSTEL",
                        roomId = "r-301",
                        roomNumber = "Room 301",
                        roomRentAmount = 1400.0,
                        bloodGroup = "O-",
                        emergencyContactNumber = "+91 94444 55667",
                        salaryAmount = 17500.0,
                        paymentMode = "BANK_TRANSFER",
                        status = "ACTIVE",
                        complianceStatus = "COMPLIANT"
                    ),
                    EmployeeEntity(
                        id = "emp-105",
                        vendorId = "v-jms",
                        clientUnitId = "cu-2",
                        employeeCode = "JMS-0202",
                        name = "Manikandan S",
                        department = "Packaging",
                        dateOfJoining = "2024-03-15",
                        dateOfBirth = "1999-07-09",
                        mobileNumber = "+91 98765 43214",
                        emailAddress = "mani.s@example.com",
                        bankAccountMasked = "••••••••3456",
                        bankName = "City Union Bank",
                        bankBranch = "Ambattur",
                        ifscMasked = "CIUB0000125",
                        uanMasked = "1009••••2233",
                        esiMasked = "3114••••4455",
                        accommodationType = "OWN",
                        roomId = null,
                        roomNumber = null,
                        roomRentAmount = 0.0,
                        bloodGroup = "AB+",
                        emergencyContactNumber = "+91 94445 66778",
                        salaryAmount = 16800.0,
                        paymentMode = "BANK_TRANSFER",
                        status = "ACTIVE",
                        complianceStatus = "COMPLIANT"
                    )
                )
                dao.insertEmployees(employees)

                // Seed Payroll Records
                val payrollRecords = listOf(
                    PayrollRecordEntity(
                        id = "pr-2026-03-101",
                        employeeId = "emp-101",
                        employeeName = "Arun Kumar",
                        employeeCode = "JCS-0101",
                        vendorId = "v-jcs",
                        department = "Assembly Line",
                        monthYear = "March 2026",
                        totalDays = 31,
                        paidDays = 31.0,
                        otHours = 12.0,
                        basicWage = 13000.0,
                        da = 2500.0,
                        hra = 2500.0,
                        allowances = 1500.0,
                        otAmount = 1450.0,
                        grossEarned = 20950.0,
                        epfEmployee = 1860.0,
                        esiEmployee = 157.0,
                        professionalTax = 200.0,
                        lwf = 20.0,
                        roomRentRecovery = 1500.0,
                        messFoodRecovery = 1200.0,
                        gasRationRecovery = 450.0,
                        advanceRecovery = 0.0,
                        otherDeductions = 0.0,
                        totalDeductions = 5387.0,
                        netPayable = 15563.0,
                        status = "APPROVED",
                        paymentBatchId = "batch-mar-01"
                    ),
                    PayrollRecordEntity(
                        id = "pr-2026-03-102",
                        employeeId = "emp-102",
                        employeeName = "Karthik Raja",
                        employeeCode = "JCS-0102",
                        vendorId = "v-jcs",
                        department = "Quality Control",
                        monthYear = "March 2026",
                        totalDays = 31,
                        paidDays = 30.0,
                        otHours = 8.0,
                        basicWage = 14000.0,
                        da = 2800.0,
                        hra = 2800.0,
                        allowances = 1400.0,
                        otAmount = 980.0,
                        grossEarned = 21980.0,
                        epfEmployee = 2016.0,
                        esiEmployee = 165.0,
                        professionalTax = 200.0,
                        lwf = 20.0,
                        roomRentRecovery = 1500.0,
                        messFoodRecovery = 1200.0,
                        gasRationRecovery = 450.0,
                        advanceRecovery = 500.0,
                        otherDeductions = 0.0,
                        totalDeductions = 6051.0,
                        netPayable = 15929.0,
                        status = "APPROVED",
                        paymentBatchId = "batch-mar-01"
                    ),
                    PayrollRecordEntity(
                        id = "pr-2026-03-103",
                        employeeId = "emp-103",
                        employeeName = "Suresh Babu",
                        employeeCode = "JCS-0103",
                        vendorId = "v-jcs",
                        department = "Maintenance",
                        monthYear = "March 2026",
                        totalDays = 31,
                        paidDays = 31.0,
                        otHours = 16.0,
                        basicWage = 12500.0,
                        da = 2200.0,
                        hra = 2400.0,
                        allowances = 1400.0,
                        otAmount = 1800.0,
                        grossEarned = 20300.0,
                        epfEmployee = 1764.0,
                        esiEmployee = 152.0,
                        professionalTax = 200.0,
                        lwf = 20.0,
                        roomRentRecovery = 1500.0,
                        messFoodRecovery = 1100.0,
                        gasRationRecovery = 450.0,
                        advanceRecovery = 0.0,
                        otherDeductions = 0.0,
                        totalDeductions = 5186.0,
                        netPayable = 15114.0,
                        status = "APPROVED",
                        paymentBatchId = "batch-mar-01"
                    ),
                    PayrollRecordEntity(
                        id = "pr-2026-03-104",
                        employeeId = "emp-104",
                        employeeName = "Vigneshwaran P",
                        employeeCode = "JMS-0201",
                        vendorId = "v-jms",
                        department = "Logistics",
                        monthYear = "March 2026",
                        totalDays = 31,
                        paidDays = 31.0,
                        otHours = 10.0,
                        basicWage = 11500.0,
                        da = 2100.0,
                        hra = 2400.0,
                        allowances = 1500.0,
                        otAmount = 1100.0,
                        grossEarned = 18600.0,
                        epfEmployee = 1632.0,
                        esiEmployee = 140.0,
                        professionalTax = 200.0,
                        lwf = 20.0,
                        roomRentRecovery = 1400.0,
                        messFoodRecovery = 1000.0,
                        gasRationRecovery = 400.0,
                        advanceRecovery = 0.0,
                        otherDeductions = 0.0,
                        totalDeductions = 4792.0,
                        netPayable = 13808.0,
                        status = "APPROVED",
                        paymentBatchId = "batch-mar-02"
                    ),
                    PayrollRecordEntity(
                        id = "pr-2026-03-105",
                        employeeId = "emp-105",
                        employeeName = "Manikandan S",
                        employeeCode = "JMS-0202",
                        vendorId = "v-jms",
                        department = "Packaging",
                        monthYear = "March 2026",
                        totalDays = 31,
                        paidDays = 29.0,
                        otHours = 6.0,
                        basicWage = 11000.0,
                        da = 2000.0,
                        hra = 2300.0,
                        allowances = 1500.0,
                        otAmount = 650.0,
                        grossEarned = 17450.0,
                        epfEmployee = 1560.0,
                        esiEmployee = 131.0,
                        professionalTax = 200.0,
                        lwf = 20.0,
                        roomRentRecovery = 0.0,
                        messFoodRecovery = 0.0,
                        gasRationRecovery = 0.0,
                        advanceRecovery = 1000.0,
                        otherDeductions = 0.0,
                        totalDeductions = 2911.0,
                        netPayable = 14539.0,
                        status = "APPROVED",
                        paymentBatchId = "batch-mar-02"
                    )
                )
                dao.insertPayrollRecords(payrollRecords)

                // Seed Room Recoveries
                val recoveries = listOf(
                    RoomRecoveryEntity(
                        id = "rec-101-mar",
                        roomId = "r-101",
                        roomNumber = "Room 101",
                        monthYear = "March 2026",
                        gasAmount = 550.0,
                        rationAmount = 450.0,
                        provisionAmount = 350.0,
                        electricityAmount = 0.0,
                        totalRoomRecovery = 1350.0,
                        roommatesCount = 3,
                        perHeadAmount = 450.0,
                        entryDate = "2026-03-05"
                    ),
                    RoomRecoveryEntity(
                        id = "rec-301-mar",
                        roomId = "r-301",
                        roomNumber = "Room 301",
                        monthYear = "March 2026",
                        gasAmount = 600.0,
                        rationAmount = 500.0,
                        provisionAmount = 500.0,
                        electricityAmount = 0.0,
                        totalRoomRecovery = 1600.0,
                        roommatesCount = 4,
                        perHeadAmount = 400.0,
                        entryDate = "2026-03-07"
                    )
                )
                dao.insertRecoveries(recoveries)

                // Seed Payment Batches
                val batches = listOf(
                    PaymentBatchEntity(
                        id = "batch-mar-01",
                        batchNumber = "CUB-BATCH-202603-001",
                        date = "2026-03-10",
                        vendorId = "v-jcs",
                        vendorName = "Joy Corporate Solutions",
                        employeeCount = 3,
                        totalDisbursement = 46606.0,
                        paymentMode = "CUB_BANK_TRANSFER",
                        status = "DISBURSED"
                    ),
                    PaymentBatchEntity(
                        id = "batch-mar-02",
                        batchNumber = "CUB-BATCH-202603-002",
                        date = "2026-03-10",
                        vendorId = "v-jms",
                        vendorName = "Joy Manpower Service",
                        employeeCount = 2,
                        totalDisbursement = 28347.0,
                        paymentMode = "CUB_BANK_TRANSFER",
                        status = "DISBURSED"
                    )
                )
                dao.insertPaymentBatches(batches)
            }
        }
    }
}
