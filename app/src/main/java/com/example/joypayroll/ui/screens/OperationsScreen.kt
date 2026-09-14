package com.example.joypayroll.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
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
import com.example.joypayroll.ui.theme.*
import com.example.joypayroll.ui.viewmodel.JoyPayrollViewModel
import java.text.NumberFormat
import java.util.Locale

@Composable
fun OperationsScreen(
    viewModel: JoyPayrollViewModel
) {
    val batches by viewModel.paymentBatches.collectAsState()
    val summary by viewModel.payrollSummary.collectAsState()
    val employees by viewModel.employees.collectAsState()
    val vendors by viewModel.vendors.collectAsState()

    val currencyFormatter = remember { NumberFormat.getCurrencyInstance(Locale("en", "IN")) }
    var showBatchCreatedSnackbar by remember { mutableStateOf(false) }

    Scaffold(
        snackbarHost = {
            if (showBatchCreatedSnackbar) {
                Snackbar(
                    modifier = Modifier.padding(16.dp),
                    action = {
                        TextButton(onClick = { showBatchCreatedSnackbar = false }) {
                            Text("OK", color = Color.White)
                        }
                    }
                ) {
                    Text("Bank Payment Batch created and exported successfully!")
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
            item {
                Text(
                    text = "Operations & Bank Batches",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onBackground
                )
                Text(
                    text = "City Union Bank salary batches & statutory compliance audit",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.secondary
                )
            }

            // Create Batch Quick Action
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            text = "Disburse Salary Batch",
                            fontWeight = FontWeight.Bold,
                            fontSize = 15.sp
                        )
                        Text(
                            text = "Generate CUB formatted corporate bulk payment file",
                            fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.secondary
                        )

                        Spacer(modifier = Modifier.height(12.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Button(
                                onClick = {
                                    viewModel.createPaymentBatch("v-jcs", "Joy Corporate Solutions", "CUB_BANK_TRANSFER")
                                    showBatchCreatedSnackbar = true
                                },
                                modifier = Modifier
                                    .weight(1f)
                                    .testTag("batch_jcs_button"),
                                colors = ButtonDefaults.buttonColors(containerColor = JoyBlue)
                            ) {
                                Text("Generate JCS Batch", fontSize = 12.sp)
                            }
                            Button(
                                onClick = {
                                    viewModel.createPaymentBatch("v-jms", "Joy Manpower Service", "CUB_BANK_TRANSFER")
                                    showBatchCreatedSnackbar = true
                                },
                                modifier = Modifier
                                    .weight(1f)
                                    .testTag("batch_jms_button"),
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF0F766E))
                            ) {
                                Text("Generate JMS Batch", fontSize = 12.sp)
                            }
                        }
                    }
                }
            }

            // Statutory Compliance Overview
            item {
                Text(
                    text = "Statutory Compliance Audit",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onBackground
                )
                Spacer(modifier = Modifier.height(8.dp))

                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        ComplianceRow("EPF ECR Format Ready", "TN/MAS/0045231", isPass = true)
                        HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
                        ComplianceRow("ESIC Monthly Filing Ready", "51000892340001001", isPass = true)
                        HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
                        ComplianceRow("Professional Tax Slab Validated", "Tamil Nadu Schedule", isPass = true)
                        HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
                        ComplianceRow("Labour Welfare Fund (LWF)", "₹20 / Employee", isPass = true)
                    }
                }
            }

            // Existing Payment Batches
            item {
                Text(
                    text = "Batch Disbursement History (${batches.size})",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onBackground
                )
            }

            items(batches) { batch ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    shape = RoundedCornerShape(12.dp),
                    elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(14.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(
                                text = batch.batchNumber,
                                fontWeight = FontWeight.Bold,
                                fontSize = 14.sp
                            )
                            Text(
                                text = "${batch.vendorName} • ${batch.employeeCount} Transfers",
                                fontSize = 12.sp,
                                color = MaterialTheme.colorScheme.secondary
                            )
                            Text(
                                text = "Date: ${batch.date} • Mode: ${batch.paymentMode}",
                                fontSize = 11.sp,
                                color = Color.Gray
                            )
                        }

                        Column(horizontalAlignment = Alignment.End) {
                            Text(
                                text = currencyFormatter.format(batch.totalDisbursement),
                                fontWeight = FontWeight.ExtraBold,
                                fontSize = 15.sp,
                                color = SuccessGreen
                            )
                            AssistChip(
                                onClick = {},
                                label = { Text(batch.status) }
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun ComplianceRow(title: String, subtitle: String, isPass: Boolean) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column {
            Text(title, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
            Text(subtitle, fontSize = 11.sp, color = MaterialTheme.colorScheme.secondary)
        }
        Icon(
            imageVector = if (isPass) Icons.Default.CheckCircle else Icons.Default.Error,
            contentDescription = "Status",
            tint = if (isPass) SuccessGreen else WarningOrange,
            modifier = Modifier.size(20.dp)
        )
    }
}
