package com.example.joypayroll.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Update
import kotlinx.coroutines.flow.Flow

@Dao
interface JoyPayrollDao {

    // Vendors
    @Query("SELECT * FROM vendors")
    fun getAllVendors(): Flow<List<VendorEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertVendors(vendors: List<VendorEntity>)

    // Employees
    @Query("SELECT * FROM employees ORDER BY name ASC")
    fun getAllEmployees(): Flow<List<EmployeeEntity>>

    @Query("SELECT * FROM employees WHERE id = :id")
    suspend fun getEmployeeById(id: String): EmployeeEntity?

    @Query("SELECT * FROM employees WHERE roomId = :roomId")
    fun getEmployeesByRoom(roomId: String): Flow<List<EmployeeEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertEmployee(employee: EmployeeEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertEmployees(employees: List<EmployeeEntity>)

    @Update
    suspend fun updateEmployee(employee: EmployeeEntity)

    // Payroll Records
    @Query("SELECT * FROM payroll_records ORDER BY employeeName ASC")
    fun getAllPayrollRecords(): Flow<List<PayrollRecordEntity>>

    @Query("SELECT * FROM payroll_records WHERE monthYear = :monthYear")
    fun getPayrollRecordsByMonth(monthYear: String): Flow<List<PayrollRecordEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertPayrollRecords(records: List<PayrollRecordEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertPayrollRecord(record: PayrollRecordEntity)

    @Query("UPDATE payroll_records SET status = :status WHERE id = :id")
    suspend fun updatePayrollStatus(id: String, status: String)

    @Query("UPDATE payroll_records SET status = 'APPROVED' WHERE monthYear = :monthYear")
    suspend fun approvePayrollForMonth(monthYear: String)

    // Hostels & Rooms
    @Query("SELECT * FROM hostels")
    fun getAllHostels(): Flow<List<HostelEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertHostels(hostels: List<HostelEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertHostel(hostel: HostelEntity)

    @Query("SELECT * FROM rooms")
    fun getAllRooms(): Flow<List<RoomEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertRooms(rooms: List<RoomEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertRoom(room: RoomEntity)

    // Room Recoveries
    @Query("SELECT * FROM room_recoveries ORDER BY entryDate DESC")
    fun getAllRecoveries(): Flow<List<RoomRecoveryEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertRecovery(recovery: RoomRecoveryEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertRecoveries(recoveries: List<RoomRecoveryEntity>)

    // Payment Batches
    @Query("SELECT * FROM payment_batches ORDER BY date DESC")
    fun getAllPaymentBatches(): Flow<List<PaymentBatchEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertPaymentBatch(batch: PaymentBatchEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertPaymentBatches(batches: List<PaymentBatchEntity>)
}
