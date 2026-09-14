package com.example.joypayroll.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.example.joypayroll.data.local.EmployeeEntity
import com.example.joypayroll.ui.theme.*
import com.example.joypayroll.ui.viewmodel.JoyPayrollViewModel
import java.text.NumberFormat
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EmployeesScreen(
    viewModel: JoyPayrollViewModel,
    onViewIdCard: (String) -> Unit
) {
    val employees by viewModel.filteredEmployees.collectAsState()
    val searchQuery by viewModel.employeeSearchQuery.collectAsState()
    val selectedVendor by viewModel.selectedVendorFilter.collectAsState()
    val vendors by viewModel.vendors.collectAsState()
    val rooms by viewModel.rooms.collectAsState()

    var showAddDialog by remember { mutableStateOf(false) }
    val currencyFormatter = remember { NumberFormat.getCurrencyInstance(Locale("en", "IN")) }

    Scaffold(
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = { showAddDialog = true },
                icon = { Icon(Icons.Default.PersonAdd, contentDescription = "Add Staff") },
                text = { Text("Add Employee") },
                containerColor = JoyBlue,
                contentColor = Color.White,
                modifier = Modifier.testTag("add_employee_fab")
            )
        }
    ) { innerPadding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .background(MaterialTheme.colorScheme.background)
                .padding(innerPadding)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            // Header
            item {
                Text(
                    text = "Staff Directory (${employees.size})",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onBackground
                )
                Text(
                    text = "Master registry with bank & accommodation profiles",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.secondary
                )
            }

            // Search Bar
            item {
                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = { viewModel.setEmployeeSearchQuery(it) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .testTag("employee_search_input"),
                    placeholder = { Text("Search by name, code, or department...") },
                    leadingIcon = { Icon(Icons.Default.Search, contentDescription = "Search") },
                    trailingIcon = {
                        if (searchQuery.isNotEmpty()) {
                            IconButton(onClick = { viewModel.setEmployeeSearchQuery("") }) {
                                Icon(Icons.Default.Clear, contentDescription = "Clear")
                            }
                        }
                    },
                    shape = RoundedCornerShape(12.dp),
                    singleLine = true
                )
            }

            // Vendor Filter Chips
            item {
                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    item {
                        FilterChip(
                            selected = selectedVendor == "ALL",
                            onClick = { viewModel.setSelectedVendorFilter("ALL") },
                            label = { Text("All Companies") }
                        )
                    }
                    items(vendors) { v ->
                        FilterChip(
                            selected = selectedVendor == v.id,
                            onClick = { viewModel.setSelectedVendorFilter(v.id) },
                            label = { Text(v.code) }
                        )
                    }
                }
            }

            // Employees List
            items(employees) { employee ->
                EmployeeCard(
                    employee = employee,
                    currencyFormatter = currencyFormatter,
                    onViewIdCard = { onViewIdCard(employee.id) }
                )
            }
        }
    }

    if (showAddDialog) {
        AddEmployeeDialog(
            vendors = vendors,
            rooms = rooms,
            onDismiss = { showAddDialog = false },
            onAdd = { name, code, vId, dept, doj, sal, bank, ac, ifsc, accom, rId, rNum ->
                viewModel.addEmployee(name, code, vId, dept, doj, sal, bank, ac, ifsc, accom, rId, rNum)
                showAddDialog = false
            }
        )
    }
}

@Composable
fun EmployeeCard(
    employee: EmployeeEntity,
    currencyFormatter: NumberFormat,
    onViewIdCard: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .testTag("employee_card_${employee.employeeCode}"),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        shape = RoundedCornerShape(12.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(40.dp)
                            .background(JoyBlueLight, RoundedCornerShape(10.dp)),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = employee.name.take(1),
                            fontWeight = FontWeight.Bold,
                            color = JoyBlueDark,
                            fontSize = 16.sp
                        )
                    }
                    Spacer(modifier = Modifier.width(10.dp))
                    Column {
                        Text(
                            text = employee.name,
                            fontWeight = FontWeight.Bold,
                            fontSize = 14.sp
                        )
                        Text(
                            text = "${employee.employeeCode} • ${employee.department}",
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.secondary
                        )
                    }
                }

                // Company Tag
                SuggestionChip(
                    onClick = {},
                    label = {
                        Text(
                            if (employee.vendorId == "v-jcs") "JCS" else "JMS",
                            fontWeight = FontWeight.Bold,
                            fontSize = 11.sp
                        )
                    }
                )
            }

            Spacer(modifier = Modifier.height(10.dp))
            HorizontalDivider(color = MaterialTheme.colorScheme.surfaceVariant)
            Spacer(modifier = Modifier.height(10.dp))

            // Details Grid
            Row(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.weight(1.2f)) {
                    Text("Bank Account", fontSize = 10.sp, color = MaterialTheme.colorScheme.secondary)
                    Text(
                        "${employee.bankName ?: "Bank"} • ${employee.bankAccountMasked ?: "••••"}",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Medium
                    )
                    Text("IFSC: ${employee.ifscMasked ?: "CIUB0000123"}", fontSize = 10.sp, color = Color.Gray)
                }

                Column(modifier = Modifier.weight(1f)) {
                    Text("Accommodation", fontSize = 10.sp, color = MaterialTheme.colorScheme.secondary)
                    if (employee.accommodationType == "HOSTEL") {
                        Text(
                            employee.roomNumber ?: "Hostel",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = JoyBlue
                        )
                        Text("Rent: ₹${employee.roomRentAmount.toInt()}", fontSize = 10.sp, color = Color.Gray)
                    } else {
                        Text("Own / Local", fontSize = 12.sp, color = Color(0xFF475569))
                    }
                }

                Column(
                    modifier = Modifier.weight(1f),
                    horizontalAlignment = Alignment.End
                ) {
                    Text("Monthly Wage", fontSize = 10.sp, color = MaterialTheme.colorScheme.secondary)
                    Text(
                        currencyFormatter.format(employee.salaryAmount),
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    FilledTonalButton(
                        onClick = onViewIdCard,
                        contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp),
                        modifier = Modifier.height(28.dp)
                    ) {
                        Icon(Icons.Default.Badge, contentDescription = "ID Card", modifier = Modifier.size(14.dp))
                        Spacer(modifier = Modifier.width(4.dp))
                        Text("ID Card", fontSize = 10.sp)
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddEmployeeDialog(
    vendors: List<com.example.joypayroll.data.local.VendorEntity>,
    rooms: List<com.example.joypayroll.data.local.RoomEntity>,
    onDismiss: () -> Unit,
    onAdd: (
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
    ) -> Unit
) {
    var name by remember { mutableStateOf("") }
    var code by remember { mutableStateOf("JCS-0104") }
    var selectedVendorId by remember { mutableStateOf(vendors.firstOrNull()?.id ?: "v-jcs") }
    var department by remember { mutableStateOf("Assembly Line") }
    var salaryText by remember { mutableStateOf("18500") }
    var bankName by remember { mutableStateOf("City Union Bank") }
    var accountNumber by remember { mutableStateOf("••••••••5566") }
    var ifsc by remember { mutableStateOf("CIUB0000123") }
    var accommodationType by remember { mutableStateOf("HOSTEL") }
    var selectedRoomId by remember { mutableStateOf(rooms.firstOrNull()?.id) }

    val selectedRoom = rooms.find { it.id == selectedRoomId }

    Dialog(onDismissRequest = onDismiss) {
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .padding(8.dp),
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
        ) {
            LazyColumn(
                modifier = Modifier
                    .padding(20.dp)
                    .fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                item {
                    Text(
                        text = "Add New Employee",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        color = JoyBlue
                    )
                }

                item {
                    OutlinedTextField(
                        value = name,
                        onValueChange = { name = it },
                        label = { Text("Full Name *") },
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("add_employee_name"),
                        singleLine = true
                    )
                }

                item {
                    OutlinedTextField(
                        value = code,
                        onValueChange = { code = it },
                        label = { Text("Employee Code *") },
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("add_employee_code"),
                        singleLine = true
                    )
                }

                item {
                    Text("Select Company / Vendor:", fontSize = 12.sp, color = MaterialTheme.colorScheme.secondary)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        vendors.forEach { v ->
                            FilterChip(
                                selected = selectedVendorId == v.id,
                                onClick = {
                                    selectedVendorId = v.id
                                    code = if (v.id == "v-jcs") "JCS-010${(4..9).random()}" else "JMS-020${(3..9).random()}"
                                },
                                label = { Text(v.name) }
                            )
                        }
                    }
                }

                item {
                    OutlinedTextField(
                        value = department,
                        onValueChange = { department = it },
                        label = { Text("Department") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                }

                item {
                    OutlinedTextField(
                        value = salaryText,
                        onValueChange = { salaryText = it },
                        label = { Text("Monthly Gross Salary (₹)") },
                        modifier = Modifier
                            .fillMaxWidth()
                            .testTag("add_employee_salary"),
                        singleLine = true
                    )
                }

                item {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = bankName,
                            onValueChange = { bankName = it },
                            label = { Text("Bank Name") },
                            modifier = Modifier.weight(1f),
                            singleLine = true
                        )
                        OutlinedTextField(
                            value = accountNumber,
                            onValueChange = { accountNumber = it },
                            label = { Text("Account No.") },
                            modifier = Modifier.weight(1f),
                            singleLine = true
                        )
                    }
                }

                item {
                    Text("Accommodation:", fontSize = 12.sp, color = MaterialTheme.colorScheme.secondary)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        FilterChip(
                            selected = accommodationType == "HOSTEL",
                            onClick = { accommodationType = "HOSTEL" },
                            label = { Text("Hostel Resident") }
                        )
                        FilterChip(
                            selected = accommodationType == "OWN",
                            onClick = { accommodationType = "OWN" },
                            label = { Text("Own Accommodation") }
                        )
                    }
                }

                item {
                    Spacer(modifier = Modifier.height(10.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.End,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        TextButton(onClick = onDismiss) {
                            Text("Cancel")
                        }
                        Spacer(modifier = Modifier.width(8.dp))
                        Button(
                            onClick = {
                                if (name.isNotBlank()) {
                                    val sal = salaryText.toDoubleOrNull() ?: 18000.0
                                    onAdd(
                                        name,
                                        code,
                                        selectedVendorId,
                                        department,
                                        "2026-03-01",
                                        sal,
                                        bankName,
                                        accountNumber,
                                        ifsc,
                                        accommodationType,
                                        if (accommodationType == "HOSTEL") selectedRoom?.id else null,
                                        if (accommodationType == "HOSTEL") selectedRoom?.roomNumber else null
                                    )
                                }
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = JoyBlue),
                            modifier = Modifier.testTag("save_employee_button")
                        ) {
                            Text("Save Employee")
                        }
                    }
                }
            }
        }
    }
}
