package com.example.joypayroll.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import com.example.joypayroll.data.local.PayrollRecordEntity
import com.example.joypayroll.ui.theme.*
import com.example.joypayroll.ui.viewmodel.JoyPayrollViewModel
import java.text.NumberFormat
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PayrollScreen(
    viewModel: JoyPayrollViewModel
) {
    val records by viewModel.filteredPayrollRecords.collectAsState()
    val summary by viewModel.payrollSummary.collectAsState()
    val selectedMonth by viewModel.selectedMonth.collectAsState()
    val selectedVendor by viewModel.selectedVendorFilter.collectAsState()
    val vendors by viewModel.vendors.collectAsState()
    val viewingPayslip by viewModel.viewingPayslipRecord.collectAsState()

    val currencyFormatter = remember { NumberFormat.getCurrencyInstance(Locale("en", "IN")) }
    var showApproveSuccessSnackbar by remember { mutableStateOf(false) }

    Scaffold(
        snackbarHost = {
            if (showApproveSuccessSnackbar) {
                Snackbar(
                    modifier = Modifier.padding(16.dp),
                    action = {
                        TextButton(onClick = { showApproveSuccessSnackbar = false }) {
                            Text("OK", color = Color.White)
                        }
                    }
                ) {
                    Text("Payroll for $selectedMonth approved successfully!")
                }
            }
        }
    ) { innerPadding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .background(MaterialTheme.colorScheme.background)
                .padding(innerPadding)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Month Selector & Filter
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = "Payroll Register (41-Col)",
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.onBackground
                        )
                        Text(
                            text = "Attendance, Statutory & Recoveries",
                            fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.secondary
                        )
                    }

                    // Month Picker Dropdown / Chip
                    AssistChip(
                        onClick = {},
                        label = { Text(selectedMonth, fontWeight = FontWeight.SemiBold) },
                        leadingIcon = {
                            Icon(Icons.Default.CalendarMonth, contentDescription = "Month", modifier = Modifier.size(16.dp))
                        }
                    )
                }
            }

            // Vendor Filter Chips
            item {
                LazyRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    item {
                        FilterChip(
                            selected = selectedVendor == "ALL",
                            onClick = { viewModel.setSelectedVendorFilter("ALL") },
                            label = { Text("All Companies") },
                            modifier = Modifier.testTag("filter_all_companies")
                        )
                    }
                    items(vendors) { vendor ->
                        FilterChip(
                            selected = selectedVendor == vendor.id,
                            onClick = { viewModel.setSelectedVendorFilter(vendor.id) },
                            label = { Text(vendor.code) },
                            modifier = Modifier.testTag("filter_${vendor.code.lowercase()}")
                        )
                    }
                }
            }

            // Summary Card
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                text = "Monthly Register Summary",
                                fontWeight = FontWeight.SemiBold,
                                fontSize = 14.sp
                            )
                            Text(
                                text = "${summary.totalEmployees} Employees",
                                fontSize = 13.sp,
                                color = JoyBlue,
                                fontWeight = FontWeight.Medium
                            )
                        }

                        Spacer(modifier = Modifier.height(12.dp))
                        HorizontalDivider()
                        Spacer(modifier = Modifier.height(12.dp))

                        Row(modifier = Modifier.fillMaxWidth()) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text("Total Gross", fontSize = 11.sp, color = MaterialTheme.colorScheme.secondary)
                                Text(
                                    currencyFormatter.format(summary.totalGross),
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 14.sp
                                )
                            }
                            Column(modifier = Modifier.weight(1f)) {
                                Text("EPF + ESI", fontSize = 11.sp, color = MaterialTheme.colorScheme.secondary)
                                Text(
                                    currencyFormatter.format(summary.totalEpf + summary.totalEsi),
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 14.sp,
                                    color = Color(0xFF0D9488)
                                )
                            }
                            Column(modifier = Modifier.weight(1f)) {
                                Text("Recoveries", fontSize = 11.sp, color = MaterialTheme.colorScheme.secondary)
                                Text(
                                    currencyFormatter.format(summary.totalRecoveries),
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 14.sp,
                                    color = WarningOrange
                                )
                            }
                            Column(modifier = Modifier.weight(1f)) {
                                Text("Net Pay", fontSize = 11.sp, color = MaterialTheme.colorScheme.secondary)
                                Text(
                                    currencyFormatter.format(summary.totalNetPayable),
                                    fontWeight = FontWeight.ExtraBold,
                                    fontSize = 14.sp,
                                    color = SuccessGreen
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(14.dp))

                        Button(
                            onClick = {
                                viewModel.approvePayroll()
                                showApproveSuccessSnackbar = true
                            },
                            modifier = Modifier
                                .fillMaxWidth()
                                .testTag("approve_payroll_button"),
                            colors = ButtonDefaults.buttonColors(containerColor = JoyBlue),
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Icon(Icons.Default.CheckCircle, contentDescription = "Approve", modifier = Modifier.size(18.dp))
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Lock & Approve $selectedMonth Payroll")
                        }
                    }
                }
            }

            // Employee Records List
            item {
                Text(
                    text = "Salary Register Entries (${records.size})",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onBackground
                )
            }

            items(records) { record ->
                PayrollRecordCard(
                    record = record,
                    onViewPayslip = { viewModel.setViewingPayslip(record) }
                )
            }
        }
    }

    // Viewing Payslip Modal Dialog
    viewingPayslip?.let { record ->
        PayslipModal(
            record = record,
            onDismiss = { viewModel.setViewingPayslip(null) }
        )
    }
}

@Composable
fun PayrollRecordCard(
    record: PayrollRecordEntity,
    onViewPayslip: () -> Unit
) {
    val currencyFormatter = remember { NumberFormat.getCurrencyInstance(Locale("en", "IN")) }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .testTag("payroll_card_${record.employeeCode}"),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
        shape = RoundedCornerShape(12.dp)
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
                            .size(36.dp)
                            .background(JoyBlueLight, RoundedCornerShape(8.dp)),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = record.employeeName.take(1),
                            fontWeight = FontWeight.Bold,
                            color = JoyBlueDark
                        )
                    }
                    Spacer(modifier = Modifier.width(10.dp))
                    Column {
                        Text(
                            text = record.employeeName,
                            fontWeight = FontWeight.Bold,
                            fontSize = 14.sp
                        )
                        Text(
                            text = "${record.employeeCode} • ${record.department}",
                            fontSize = 11.sp,
                            color = MaterialTheme.colorScheme.secondary
                        )
                    }
                }

                AssistChip(
                    onClick = {},
                    label = { Text("${record.paidDays.toInt()}/${record.totalDays} Days") }
                )
            }

            Spacer(modifier = Modifier.height(10.dp))
            HorizontalDivider(color = MaterialTheme.colorScheme.surfaceVariant)
            Spacer(modifier = Modifier.height(10.dp))

            Row(modifier = Modifier.fillMaxWidth()) {
                // Earnings column
                Column(modifier = Modifier.weight(1f)) {
                    Text("Gross Earned", fontSize = 11.sp, color = MaterialTheme.colorScheme.secondary)
                    Text(
                        currencyFormatter.format(record.grossEarned),
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                    Text(
                        "Basic: ${currencyFormatter.format(record.basicWage)}",
                        fontSize = 10.sp,
                        color = Color.Gray
                    )
                    if (record.otAmount > 0) {
                        Text(
                            "OT (${record.otHours}h): ${currencyFormatter.format(record.otAmount)}",
                            fontSize = 10.sp,
                            color = JoyBlue
                        )
                    }
                }

                // Deductions column
                Column(modifier = Modifier.weight(1f)) {
                    Text("Total Deductions", fontSize = 11.sp, color = MaterialTheme.colorScheme.secondary)
                    Text(
                        "- ${currencyFormatter.format(record.totalDeductions)}",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = ErrorRed
                    )
                    Text(
                        "EPF+ESI: ${currencyFormatter.format(record.epfEmployee + record.esiEmployee)}",
                        fontSize = 10.sp,
                        color = Color.Gray
                    )
                    if (record.roomRentRecovery + record.gasRationRecovery > 0) {
                        Text(
                            "Recv: ${currencyFormatter.format(record.roomRentRecovery + record.gasRationRecovery)}",
                            fontSize = 10.sp,
                            color = WarningOrange
                        )
                    }
                }

                // Net Pay column
                Column(
                    modifier = Modifier.weight(1f),
                    horizontalAlignment = Alignment.End
                ) {
                    Text("Net Disbursed", fontSize = 11.sp, color = MaterialTheme.colorScheme.secondary)
                    Text(
                        currencyFormatter.format(record.netPayable),
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Bold,
                        color = SuccessGreen
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    OutlinedButton(
                        onClick = onViewPayslip,
                        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 2.dp),
                        modifier = Modifier.height(30.dp)
                    ) {
                        Text("Payslip", fontSize = 11.sp)
                    }
                }
            }
        }
    }
}

@Composable
fun PayslipModal(
    record: PayrollRecordEntity,
    onDismiss: () -> Unit
) {
    val currencyFormatter = remember { NumberFormat.getCurrencyInstance(Locale("en", "IN")) }
    val companyName = if (record.vendorId == "v-jcs") "JOY CORPORATE SOLUTIONS PVT LTD" else "JOY MANPOWER SERVICE LLP"

    Dialog(onDismissRequest = onDismiss) {
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
        ) {
            Column(
                modifier = Modifier
                    .padding(20.dp)
                    .fillMaxWidth()
            ) {
                // Header
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = companyName,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            color = JoyBlue
                        )
                        Text(
                            text = "SALARY SLIP - ${record.monthYear.uppercase()}",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = MaterialTheme.colorScheme.secondary
                        )
                    }
                    IconButton(onClick = onDismiss, modifier = Modifier.size(24.dp)) {
                        Icon(Icons.Default.Close, contentDescription = "Close")
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))
                HorizontalDivider()
                Spacer(modifier = Modifier.height(12.dp))

                // Employee Info Grid
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Column {
                        Text("Employee Name:", fontSize = 11.sp, color = MaterialTheme.colorScheme.secondary)
                        Text(record.employeeName, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                        Spacer(modifier = Modifier.height(4.dp))
                        Text("Department:", fontSize = 11.sp, color = MaterialTheme.colorScheme.secondary)
                        Text(record.department, fontSize = 12.sp)
                    }
                    Column(horizontalAlignment = Alignment.End) {
                        Text("Employee Code:", fontSize = 11.sp, color = MaterialTheme.colorScheme.secondary)
                        Text(record.employeeCode, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                        Spacer(modifier = Modifier.height(4.dp))
                        Text("Paid Days / Total:", fontSize = 11.sp, color = MaterialTheme.colorScheme.secondary)
                        Text("${record.paidDays.toInt()} / ${record.totalDays}", fontSize = 12.sp)
                    }
                }

                Spacer(modifier = Modifier.height(14.dp))

                // Earnings & Deductions Table
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .border(1.dp, MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(8.dp))
                        .padding(10.dp)
                ) {
                    // Earnings
                    Column(modifier = Modifier.weight(1f)) {
                        Text("EARNINGS", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = JoyBlue)
                        Spacer(modifier = Modifier.height(4.dp))
                        PayslipRow("Basic Wage", currencyFormatter.format(record.basicWage))
                        PayslipRow("DA", currencyFormatter.format(record.da))
                        PayslipRow("HRA", currencyFormatter.format(record.hra))
                        PayslipRow("Allowances", currencyFormatter.format(record.allowances))
                        if (record.otAmount > 0) {
                            PayslipRow("OT Pay", currencyFormatter.format(record.otAmount))
                        }
                        Spacer(modifier = Modifier.height(4.dp))
                        HorizontalDivider()
                        Spacer(modifier = Modifier.height(4.dp))
                        PayslipRow("Gross Earnings", currencyFormatter.format(record.grossEarned), isBold = true)
                    }

                    Spacer(modifier = Modifier.width(12.dp))

                    // Deductions
                    Column(modifier = Modifier.weight(1f)) {
                        Text("DEDUCTIONS", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = ErrorRed)
                        Spacer(modifier = Modifier.height(4.dp))
                        PayslipRow("EPF (12%)", currencyFormatter.format(record.epfEmployee))
                        PayslipRow("ESI (0.75%)", currencyFormatter.format(record.esiEmployee))
                        PayslipRow("Prof. Tax", currencyFormatter.format(record.professionalTax))
                        PayslipRow("LWF", currencyFormatter.format(record.lwf))
                        if (record.roomRentRecovery > 0) {
                            PayslipRow("Room Rent", currencyFormatter.format(record.roomRentRecovery))
                        }
                        if (record.gasRationRecovery > 0) {
                            PayslipRow("Gas/Ration", currencyFormatter.format(record.gasRationRecovery))
                        }
                        Spacer(modifier = Modifier.height(4.dp))
                        HorizontalDivider()
                        Spacer(modifier = Modifier.height(4.dp))
                        PayslipRow("Total Ded.", currencyFormatter.format(record.totalDeductions), isBold = true)
                    }
                }

                Spacer(modifier = Modifier.height(14.dp))

                // Net Payable Highlight
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = JoyBlueLight)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(12.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "NET PAYABLE:",
                            fontWeight = FontWeight.Bold,
                            color = JoyBlueDark,
                            fontSize = 14.sp
                        )
                        Text(
                            text = currencyFormatter.format(record.netPayable),
                            fontWeight = FontWeight.ExtraBold,
                            color = JoyBlueDark,
                            fontSize = 18.sp
                        )
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                Button(
                    onClick = onDismiss,
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(containerColor = JoyBlue)
                ) {
                    Text("Close Payslip")
                }
            }
        }
    }
}

@Composable
fun PayslipRow(label: String, value: String, isBold: Boolean = false) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 2.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            text = label,
            fontSize = 11.sp,
            fontWeight = if (isBold) FontWeight.Bold else FontWeight.Normal,
            color = if (isBold) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.secondary
        )
        Text(
            text = value,
            fontSize = 11.sp,
            fontWeight = if (isBold) FontWeight.Bold else FontWeight.Normal,
            color = MaterialTheme.colorScheme.onSurface
        )
    }
}
