package com.example.joypayroll.ui.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.example.joypayroll.data.local.EmployeeEntity
import com.example.joypayroll.data.local.HostelEntity
import com.example.joypayroll.data.local.PaymentBatchEntity
import com.example.joypayroll.data.local.PayrollRecordEntity
import com.example.joypayroll.data.local.RoomEntity
import com.example.joypayroll.data.local.RoomRecoveryEntity
import com.example.joypayroll.data.local.VendorEntity
import com.example.joypayroll.data.repository.JoyPayrollRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.util.UUID

data class PayrollSummary(
    val totalEmployees: Int = 0,
    val totalGross: Double = 0.0,
    val totalEpf: Double = 0.0,
    val totalEsi: Double = 0.0,
    val totalRecoveries: Double = 0.0,
    val totalNetPayable: Double = 0.0
)

class JoyPayrollViewModel(private val repository: JoyPayrollRepository) : ViewModel() {

    val vendors: StateFlow<List<VendorEntity>> = repository.allVendors.stateIn(
        viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList()
    )

    val employees: StateFlow<List<EmployeeEntity>> = repository.allEmployees.stateIn(
        viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList()
    )

    val payrollRecords: StateFlow<List<PayrollRecordEntity>> = repository.allPayrollRecords.stateIn(
        viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList()
    )

    val hostels: StateFlow<List<HostelEntity>> = repository.allHostels.stateIn(
        viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList()
    )

    val rooms: StateFlow<List<RoomEntity>> = repository.allRooms.stateIn(
        viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList()
    )

    val recoveries: StateFlow<List<RoomRecoveryEntity>> = repository.allRecoveries.stateIn(
        viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList()
    )

    val paymentBatches: StateFlow<List<PaymentBatchEntity>> = repository.allPaymentBatches.stateIn(
        viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList()
    )

    // Filter states
    private val _selectedMonth = MutableStateFlow("March 2026")
    val selectedMonth = _selectedMonth.asStateFlow()

    private val _employeeSearchQuery = MutableStateFlow("")
    val employeeSearchQuery = _employeeSearchQuery.asStateFlow()

    private val _selectedVendorFilter = MutableStateFlow("ALL")
    val selectedVendorFilter = _selectedVendorFilter.asStateFlow()

    private val _selectedIdCardEmployeeId = MutableStateFlow<String?>("emp-101")
    val selectedIdCardEmployeeId = _selectedIdCardEmployeeId.asStateFlow()

    private val _viewingPayslipRecord = MutableStateFlow<PayrollRecordEntity?>(null)
    val viewingPayslipRecord = _viewingPayslipRecord.asStateFlow()

    // Filtered Payroll Records
    val filteredPayrollRecords: StateFlow<List<PayrollRecordEntity>> = combine(
        payrollRecords, selectedMonth, selectedVendorFilter
    ) { records, month, vendorFilter ->
        records.filter { record ->
            record.monthYear == month && (vendorFilter == "ALL" || record.vendorId == vendorFilter)
        }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    // Payroll Summary for selected view
    val payrollSummary: StateFlow<PayrollSummary> = filteredPayrollRecords.combine(filteredPayrollRecords) { list, _ ->
        PayrollSummary(
            totalEmployees = list.size,
            totalGross = list.sumOf { it.grossEarned },
            totalEpf = list.sumOf { it.epfEmployee },
            totalEsi = list.sumOf { it.esiEmployee },
            totalRecoveries = list.sumOf { it.roomRentRecovery + it.gasRationRecovery + it.messFoodRecovery + it.advanceRecovery },
            totalNetPayable = list.sumOf { it.netPayable }
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), PayrollSummary())

    // Filtered Employees
    val filteredEmployees: StateFlow<List<EmployeeEntity>> = combine(
        employees, employeeSearchQuery, selectedVendorFilter
    ) { emps, query, vendor ->
        emps.filter { emp ->
            val matchesQuery = query.isEmpty() ||
                    emp.name.contains(query, ignoreCase = true) ||
                    emp.employeeCode.contains(query, ignoreCase = true) ||
                    emp.department.contains(query, ignoreCase = true)
            val matchesVendor = vendor == "ALL" || emp.vendorId == vendor
            matchesQuery && matchesVendor
        }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    fun setSelectedMonth(month: String) {
        _selectedMonth.value = month
    }

    fun setEmployeeSearchQuery(query: String) {
        _employeeSearchQuery.value = query
    }

    fun setSelectedVendorFilter(vendorId: String) {
        _selectedVendorFilter.value = vendorId
    }

    fun setSelectedIdCardEmployeeId(empId: String?) {
        _selectedIdCardEmployeeId.value = empId
    }

    fun setViewingPayslip(record: PayrollRecordEntity?) {
        _viewingPayslipRecord.value = record
    }

    fun addEmployee(
        name: String,
        code: String,
        vendorId: String,
        department: String,
        joiningDate: String,
        salary: Double,
        bankName: String,
        accountMasked: String,
        ifsc: String,
        accommodationType: String,
        roomId: String?,
        roomNumber: String?
    ) {
        viewModelScope.launch {
            val id = "emp-${UUID.randomUUID().toString().take(6)}"
            val employee = EmployeeEntity(
                id = id,
                vendorId = vendorId,
                clientUnitId = if (vendorId == "v-jcs") "cu-1" else "cu-2",
                employeeCode = code,
                name = name,
                department = department,
                dateOfJoining = joiningDate,
                dateOfBirth = "1996-01-01",
                mobileNumber = "+91 98765 00000",
                emailAddress = "${name.lowercase().replace(" ", "")}@joypayroll.com",
                bankAccountMasked = accountMasked,
                bankName = bankName,
                bankBranch = "Main Branch",
                ifscMasked = ifsc,
                uanMasked = "1009••••9999",
                esiMasked = "3114••••9999",
                accommodationType = accommodationType,
                roomId = roomId,
                roomNumber = roomNumber,
                roomRentAmount = if (accommodationType == "HOSTEL") 1500.0 else 0.0,
                bloodGroup = "B+",
                emergencyContactNumber = "+91 94440 00000",
                salaryAmount = salary,
                paymentMode = "BANK_TRANSFER",
                status = "ACTIVE",
                complianceStatus = "COMPLIANT"
            )
            repository.insertEmployee(employee)

            // Also generate initial draft payroll record for current month
            val basic = salary * 0.6
            val da = salary * 0.15
            val hra = salary * 0.15
            val allowances = salary * 0.10
            val epf = (basic + da) * 0.12
            val esi = salary * 0.0075
            val rent = if (accommodationType == "HOSTEL") 1500.0 else 0.0
            val totalDeductions = epf + esi + 200.0 + 20.0 + rent
            val net = salary - totalDeductions

            val pr = PayrollRecordEntity(
                id = "pr-${UUID.randomUUID().toString().take(8)}",
                employeeId = id,
                employeeName = name,
                employeeCode = code,
                vendorId = vendorId,
                department = department,
                monthYear = selectedMonth.value,
                totalDays = 30,
                paidDays = 30.0,
                otHours = 0.0,
                basicWage = basic,
                da = da,
                hra = hra,
                allowances = allowances,
                otAmount = 0.0,
                grossEarned = salary,
                epfEmployee = epf,
                esiEmployee = esi,
                professionalTax = 200.0,
                lwf = 20.0,
                roomRentRecovery = rent,
                messFoodRecovery = 0.0,
                gasRationRecovery = 0.0,
                advanceRecovery = 0.0,
                otherDeductions = 0.0,
                totalDeductions = totalDeductions,
                netPayable = net,
                status = "APPROVED",
                paymentBatchId = null
            )
            repository.insertPayrollRecord(pr)
        }
    }

    fun approvePayroll() {
        viewModelScope.launch {
            repository.approvePayrollForMonth(selectedMonth.value)
        }
    }

    fun addHostel(name: String, location: String, roomsCount: Int, bedsCount: Int, caretaker: String, phone: String) {
        viewModelScope.launch {
            val hostelId = "h-${UUID.randomUUID().toString().take(6)}"
            val hostel = HostelEntity(
                id = hostelId,
                name = name,
                areaLocation = location,
                totalRooms = roomsCount,
                totalBeds = bedsCount,
                caretakerName = caretaker,
                caretakerMobile = phone
            )
            repository.insertHostel(hostel)
        }
    }

    fun addRoom(hostelId: String, hostelName: String, roomNumber: String, floor: String, capacity: Int, rent: Double) {
        viewModelScope.launch {
            val roomId = "r-${UUID.randomUUID().toString().take(6)}"
            val room = RoomEntity(
                id = roomId,
                hostelId = hostelId,
                hostelName = hostelName,
                roomNumber = roomNumber,
                floor = floor,
                bedCapacity = capacity,
                currentOccupancy = 0,
                baseRent = rent
            )
            repository.insertRoom(room)
        }
    }

    fun addRoomRecovery(
        roomId: String,
        roomNumber: String,
        gas: Double,
        ration: Double,
        provision: Double,
        electricity: Double,
        roommates: Int,
        entryDate: String
    ) {
        viewModelScope.launch {
            val total = gas + ration + provision + electricity
            val count = if (roommates > 0) roommates else 1
            val perHead = total / count
            val recovery = RoomRecoveryEntity(
                id = "rec-${UUID.randomUUID().toString().take(6)}",
                roomId = roomId,
                roomNumber = roomNumber,
                monthYear = selectedMonth.value,
                gasAmount = gas,
                rationAmount = ration,
                provisionAmount = provision,
                electricityAmount = electricity,
                totalRoomRecovery = total,
                roommatesCount = count,
                perHeadAmount = perHead,
                entryDate = entryDate
            )
            repository.insertRecovery(recovery)
        }
    }

    fun createPaymentBatch(vendorId: String, vendorName: String, mode: String) {
        viewModelScope.launch {
            val records = filteredPayrollRecords.value.filter { it.vendorId == vendorId }
            val count = records.size
            val total = records.sumOf { it.netPayable }
            val batchNumber = "CUB-BATCH-${System.currentTimeMillis().toString().takeLast(6)}"
            val batch = PaymentBatchEntity(
                id = "batch-${UUID.randomUUID().toString().take(6)}",
                batchNumber = batchNumber,
                date = "2026-03-15",
                vendorId = vendorId,
                vendorName = vendorName,
                employeeCount = count,
                totalDisbursement = total,
                paymentMode = mode,
                status = "DISBURSED"
            )
            repository.insertPaymentBatch(batch)
        }
    }
}

class JoyPayrollViewModelFactory(private val repository: JoyPayrollRepository) : ViewModelProvider.Factory {
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        if (modelClass.isAssignableFrom(JoyPayrollViewModel::class.java)) {
            @Suppress("UNCHECKED_CAST")
            return JoyPayrollViewModel(repository) as T
        }
        throw IllegalArgumentException("Unknown ViewModel class")
    }
}
