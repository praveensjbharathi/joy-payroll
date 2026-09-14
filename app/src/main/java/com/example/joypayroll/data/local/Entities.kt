package com.example.joypayroll.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "vendors")
data class VendorEntity(
    @PrimaryKey val id: String,
    val code: String,
    val name: String,
    val legalName: String,
    val epfCode: String?,
    val esiCode: String?,
    val gstin: String?,
    val status: String
)

@Entity(tableName = "client_units")
data class ClientUnitEntity(
    @PrimaryKey val id: String,
    val vendorId: String,
    val clientName: String,
    val unitName: String,
    val location: String,
    val employeeCount: Int,
    val attendanceCycleStartDay: Int,
    val attendanceCycleEndDay: Int,
    val overtimeMultiplier: Double
)

@Entity(tableName = "employees")
data class EmployeeEntity(
    @PrimaryKey val id: String,
    val vendorId: String,
    val clientUnitId: String,
    val employeeCode: String,
    val name: String,
    val department: String,
    val dateOfJoining: String,
    val dateOfBirth: String?,
    val mobileNumber: String?,
    val emailAddress: String?,
    val bankAccountMasked: String?,
    val bankName: String?,
    val bankBranch: String?,
    val ifscMasked: String?,
    val uanMasked: String?,
    val esiMasked: String?,
    val accommodationType: String,
    val roomId: String?,
    val roomNumber: String?,
    val roomRentAmount: Double,
    val bloodGroup: String?,
    val emergencyContactNumber: String?,
    val salaryAmount: Double,
    val paymentMode: String,
    val status: String,
    val complianceStatus: String
)

@Entity(tableName = "payroll_records")
data class PayrollRecordEntity(
    @PrimaryKey val id: String,
    val employeeId: String,
    val employeeName: String,
    val employeeCode: String,
    val vendorId: String,
    val department: String,
    val monthYear: String,
    val totalDays: Int,
    val paidDays: Double,
    val otHours: Double,
    val basicWage: Double,
    val da: Double,
    val hra: Double,
    val allowances: Double,
    val otAmount: Double,
    val grossEarned: Double,
    val epfEmployee: Double,
    val esiEmployee: Double,
    val professionalTax: Double,
    val lwf: Double,
    val roomRentRecovery: Double,
    val messFoodRecovery: Double,
    val gasRationRecovery: Double,
    val advanceRecovery: Double,
    val otherDeductions: Double,
    val totalDeductions: Double,
    val netPayable: Double,
    val status: String,
    val paymentBatchId: String?
)

@Entity(tableName = "hostels")
data class HostelEntity(
    @PrimaryKey val id: String,
    val name: String,
    val areaLocation: String,
    val totalRooms: Int,
    val totalBeds: Int,
    val caretakerName: String,
    val caretakerMobile: String
)

@Entity(tableName = "rooms")
data class RoomEntity(
    @PrimaryKey val id: String,
    val hostelId: String,
    val hostelName: String,
    val roomNumber: String,
    val floor: String,
    val bedCapacity: Int,
    val currentOccupancy: Int,
    val baseRent: Double
)

@Entity(tableName = "room_recoveries")
data class RoomRecoveryEntity(
    @PrimaryKey val id: String,
    val roomId: String,
    val roomNumber: String,
    val monthYear: String,
    val gasAmount: Double,
    val rationAmount: Double,
    val provisionAmount: Double,
    val electricityAmount: Double,
    val totalRoomRecovery: Double,
    val roommatesCount: Int,
    val perHeadAmount: Double,
    val entryDate: String
)

@Entity(tableName = "payment_batches")
data class PaymentBatchEntity(
    @PrimaryKey val id: String,
    val batchNumber: String,
    val date: String,
    val vendorId: String,
    val vendorName: String,
    val employeeCount: Int,
    val totalDisbursement: Double,
    val paymentMode: String,
    val status: String
)
