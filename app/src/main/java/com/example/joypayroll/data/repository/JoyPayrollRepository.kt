package com.example.joypayroll.data.repository

import com.example.joypayroll.data.local.EmployeeEntity
import com.example.joypayroll.data.local.HostelEntity
import com.example.joypayroll.data.local.JoyPayrollDao
import com.example.joypayroll.data.local.PaymentBatchEntity
import com.example.joypayroll.data.local.PayrollRecordEntity
import com.example.joypayroll.data.local.RoomEntity
import com.example.joypayroll.data.local.RoomRecoveryEntity
import com.example.joypayroll.data.local.VendorEntity
import kotlinx.coroutines.flow.Flow

class JoyPayrollRepository(private val dao: JoyPayrollDao) {

    val allVendors: Flow<List<VendorEntity>> = dao.getAllVendors()
    val allEmployees: Flow<List<EmployeeEntity>> = dao.getAllEmployees()
    val allPayrollRecords: Flow<List<PayrollRecordEntity>> = dao.getAllPayrollRecords()
    val allHostels: Flow<List<HostelEntity>> = dao.getAllHostels()
    val allRooms: Flow<List<RoomEntity>> = dao.getAllRooms()
    val allRecoveries: Flow<List<RoomRecoveryEntity>> = dao.getAllRecoveries()
    val allPaymentBatches: Flow<List<PaymentBatchEntity>> = dao.getAllPaymentBatches()

    suspend fun getEmployeeById(id: String): EmployeeEntity? = dao.getEmployeeById(id)

    suspend fun insertEmployee(employee: EmployeeEntity) {
        dao.insertEmployee(employee)
    }

    suspend fun updateEmployee(employee: EmployeeEntity) {
        dao.updateEmployee(employee)
    }

    suspend fun insertPayrollRecord(record: PayrollRecordEntity) {
        dao.insertPayrollRecord(record)
    }

    suspend fun approvePayrollForMonth(monthYear: String) {
        dao.approvePayrollForMonth(monthYear)
    }

    suspend fun insertHostel(hostel: HostelEntity) {
        dao.insertHostel(hostel)
    }

    suspend fun insertRoom(room: RoomEntity) {
        dao.insertRoom(room)
    }

    suspend fun insertRecovery(recovery: RoomRecoveryEntity) {
        dao.insertRecovery(recovery)
    }

    suspend fun insertPaymentBatch(batch: PaymentBatchEntity) {
        dao.insertPaymentBatch(batch)
    }
}
