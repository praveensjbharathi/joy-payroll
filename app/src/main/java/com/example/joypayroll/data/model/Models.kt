package com.example.joypayroll.data.model

data class Vendor(
    val id: String,
    val code: String,
    val name: String,
    val legalName: String,
    val epfCode: String? = null,
    val esiCode: String? = null,
    val gstin: String? = null,
    val status: String = "ACTIVE"
)

data class ClientUnit(
    val id: String,
    val vendorId: String,
    val clientName: String,
    val unitName: String,
    val location: String,
    val employeeCount: Int = 0,
    val attendanceCycleStartDay: Int = 1,
    val attendanceCycleEndDay: Int = 30,
    val overtimeMultiplier: Double = 1.0
)

data class Employee(
    val id: String,
    val vendorId: String,
    val clientUnitId: String,
    val employeeCode: String,
    val name: String,
    val department: String,
    val dateOfJoining: String,
    val dateOfBirth: String? = null,
    val mobileNumber: String? = null,
    val emailAddress: String? = null,
    val bankAccountMasked: String? = null,
    val bankName: String? = null,
    val bankBranch: String? = null,
    val ifscMasked: String? = null,
    val uanMasked: String? = null,
    val esiMasked: String? = null,
    val accommodationType: String = "HOSTEL", // HOSTEL or OWN
    val roomId: String? = null,
    val roomNumber: String? = null,
    val roomRentAmount: Double = 0.0,
    val bloodGroup: String? = null,
    val emergencyContactNumber: String? = null,
    val salaryAmount: Double = 18000.0,
    val paymentMode: String = "BANK_TRANSFER",
    val status: String = "ACTIVE",
    val complianceStatus: String = "COMPLIANT"
)

data class PayrollRecord(
    val id: String,
    val employeeId: String,
    val employeeName: String,
    val employeeCode: String,
    val vendorId: String,
    val department: String,
    val monthYear: String, // e.g. "March 2026"
    // Attendance
    val totalDays: Int = 30,
    val paidDays: Double = 30.0,
    val otHours: Double = 0.0,
    // Earnings
    val basicWage: Double = 12000.0,
    val da: Double = 2000.0,
    val hra: Double = 3000.0,
    val allowances: Double = 1000.0,
    val otAmount: Double = 0.0,
    val grossEarned: Double = 18000.0,
    // Statutory Deductions
    val epfEmployee: Double = 1440.0, // 12% of basic+da
    val esiEmployee: Double = 135.0,  // 0.75% of gross
    val professionalTax: Double = 200.0,
    val lwf: Double = 20.0,
    // Company Recoveries
    val roomRentRecovery: Double = 0.0,
    val messFoodRecovery: Double = 0.0,
    val gasRationRecovery: Double = 0.0,
    val advanceRecovery: Double = 0.0,
    val otherDeductions: Double = 0.0,
    val totalDeductions: Double = 1795.0,
    // Net
    val netPayable: Double = 16205.0,
    val status: String = "APPROVED", // DRAFT, APPROVED, PAID
    val paymentBatchId: String? = null
)

data class Hostel(
    val id: String,
    val name: String,
    val areaLocation: String,
    val totalRooms: Int,
    val totalBeds: Int,
    val caretakerName: String,
    val caretakerMobile: String
)

data class Room(
    val id: String,
    val hostelId: String,
    val hostelName: String,
    val roomNumber: String,
    val floor: String = "1st Floor",
    val bedCapacity: Int = 4,
    val currentOccupancy: Int = 3,
    val baseRent: Double = 4500.0
)

data class RoomRecovery(
    val id: String,
    val roomId: String,
    val roomNumber: String,
    val monthYear: String,
    val gasAmount: Double = 0.0,
    val rationAmount: Double = 0.0,
    val provisionAmount: Double = 0.0,
    val electricityAmount: Double = 0.0,
    val totalRoomRecovery: Double = 0.0,
    val roommatesCount: Int = 1,
    val perHeadAmount: Double = 0.0,
    val entryDate: String
)

data class PaymentBatch(
    val id: String,
    val batchNumber: String,
    val date: String,
    val vendorId: String,
    val vendorName: String,
    val employeeCount: Int,
    val totalDisbursement: Double,
    val paymentMode: String, // CUB_BANK_TRANSFER, NEFT, IMPS
    val status: String // PENDING, DISBURSED
)
