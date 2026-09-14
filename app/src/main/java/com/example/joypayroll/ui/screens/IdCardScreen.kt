package com.example.joypayroll.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.joypayroll.data.local.EmployeeEntity
import com.example.joypayroll.ui.theme.*
import com.example.joypayroll.ui.viewmodel.JoyPayrollViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun IdCardScreen(
    viewModel: JoyPayrollViewModel
) {
    val employees by viewModel.employees.collectAsState()
    val selectedEmpId by viewModel.selectedIdCardEmployeeId.collectAsState()

    val currentEmployee = employees.find { it.id == selectedEmpId } ?: employees.firstOrNull()
    var isFrontSide by remember { mutableStateOf(true) }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        item {
            Text(
                text = "Digital Employee Identity Card",
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.onBackground
            )
            Text(
                text = "Official Joy Group staff identification badge",
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.secondary
            )
        }

        // Employee Selector
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                shape = RoundedCornerShape(12.dp)
            ) {
                Column(modifier = Modifier.padding(14.dp)) {
                    Text("Select Employee:", fontSize = 12.sp, color = MaterialTheme.colorScheme.secondary)
                    Spacer(modifier = Modifier.height(6.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        employees.take(3).forEach { emp ->
                            FilterChip(
                                selected = emp.id == currentEmployee?.id,
                                onClick = { viewModel.setSelectedIdCardEmployeeId(emp.id) },
                                label = { Text(emp.name.split(" ").first()) }
                            )
                        }
                    }
                }
            }
        }

        // Toggle Front / Back
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.Center
            ) {
                SingleChoiceSegmentedButtonRow {
                    SegmentedButton(
                        selected = isFrontSide,
                        onClick = { isFrontSide = true },
                        shape = SegmentedButtonDefaults.itemShape(index = 0, count = 2)
                    ) {
                        Text("Front Side")
                    }
                    SegmentedButton(
                        selected = !isFrontSide,
                        onClick = { isFrontSide = false },
                        shape = SegmentedButtonDefaults.itemShape(index = 1, count = 2)
                    ) {
                        Text("Back Side")
                    }
                }
            }
        }

        // The ID Card Presentation
        item {
            if (currentEmployee != null) {
                val isJcs = currentEmployee.vendorId == "v-jcs"
                val primaryThemeColor = if (isJcs) JoyBlue else Color(0xFF0D9488)
                val companyName = if (isJcs) "JOY CORPORATE SOLUTIONS" else "JOY MANPOWER SERVICE"
                val subTitle = if (isJcs) "PVT. LTD. • CHENNAI" else "LLP • CHENNAI"

                Card(
                    modifier = Modifier
                        .width(320.dp)
                        .height(480.dp)
                        .testTag("id_card_view"),
                    shape = RoundedCornerShape(18.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    elevation = CardDefaults.cardElevation(defaultElevation = 6.dp)
                ) {
                    if (isFrontSide) {
                        // FRONT SIDE
                        Column(
                            modifier = Modifier.fillMaxSize(),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            // Top Header Banner
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(100.dp)
                                    .background(primaryThemeColor)
                                    .padding(12.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                    Text(
                                        text = companyName,
                                        fontWeight = FontWeight.ExtraBold,
                                        fontSize = 14.sp,
                                        color = Color.White,
                                        textAlign = TextAlign.Center
                                    )
                                    Text(
                                        text = subTitle,
                                        fontSize = 10.sp,
                                        color = Color.White.copy(alpha = 0.8f),
                                        letterSpacing = 1.sp
                                    )
                                }
                            }

                            Spacer(modifier = Modifier.height(16.dp))

                            // Avatar / Photo Placeholder
                            Box(
                                modifier = Modifier
                                    .size(96.dp)
                                    .clip(CircleShape)
                                    .border(3.dp, primaryThemeColor, CircleShape)
                                    .background(JoyBlueLight),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Person,
                                    contentDescription = "Staff Photo",
                                    tint = primaryThemeColor,
                                    modifier = Modifier.size(54.dp)
                                )
                            }

                            Spacer(modifier = Modifier.height(12.dp))

                            // Employee Name & Designation
                            Text(
                                text = currentEmployee.name,
                                fontWeight = FontWeight.Bold,
                                fontSize = 18.sp,
                                color = Color(0xFF0F172A)
                            )
                            Text(
                                text = currentEmployee.department,
                                fontSize = 13.sp,
                                color = MaterialTheme.colorScheme.secondary,
                                fontWeight = FontWeight.Medium
                            )

                            Spacer(modifier = Modifier.height(16.dp))

                            // Details block
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(horizontal = 24.dp),
                                verticalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                IdCardDataRow("EMP ID", currentEmployee.employeeCode)
                                IdCardDataRow("JOINING", currentEmployee.dateOfJoining)
                                IdCardDataRow("BLOOD GROUP", currentEmployee.bloodGroup ?: "O+")
                                IdCardDataRow("MOBILE", currentEmployee.mobileNumber ?: "+91 98765 43210")
                            }

                            Spacer(modifier = Modifier.weight(1f))

                            // Bottom Strip
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(36.dp)
                                    .background(primaryThemeColor.copy(alpha = 0.1f))
                                    .padding(horizontal = 16.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = "AUTHORISED SIGNATORY",
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    letterSpacing = 1.5.sp,
                                    color = primaryThemeColor
                                )
                            }
                        }
                    } else {
                        // BACK SIDE
                        Column(
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(20.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.SpaceBetween
                        ) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text(
                                    text = "TERMS & CONDITIONS",
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 12.sp,
                                    color = primaryThemeColor,
                                    letterSpacing = 1.sp
                                )
                                Spacer(modifier = Modifier.height(8.dp))
                                Text(
                                    text = "• This identity card is property of the Joy Group.\n" +
                                            "• If lost or found, kindly return to the nearest company facility.\n" +
                                            "• Surrender upon departure or end of contract.",
                                    fontSize = 10.sp,
                                    color = Color(0xFF475569),
                                    lineHeight = 15.sp
                                )
                            }

                            Column(
                                modifier = Modifier.fillMaxWidth(),
                                verticalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                IdCardDataRow("EMERGENCY", currentEmployee.emergencyContactNumber ?: "+91 94440 00000")
                                IdCardDataRow("ACCOMMODATION", currentEmployee.roomNumber ?: "Own/Private")
                                IdCardDataRow("UAN", currentEmployee.uanMasked ?: "1009••••7821")
                                IdCardDataRow("ESIC NO", currentEmployee.esiMasked ?: "3114••••9012")
                            }

                            // QR Code Simulation Graphic
                            Box(
                                modifier = Modifier
                                    .size(70.dp)
                                    .border(1.dp, Color.LightGray, RoundedCornerShape(6.dp))
                                    .padding(6.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = Icons.Default.QrCode2,
                                    contentDescription = "QR Code",
                                    tint = primaryThemeColor,
                                    modifier = Modifier.size(56.dp)
                                )
                            }

                            Text(
                                text = "Joy Group Corporate Office • Industrial Area, Chennai",
                                fontSize = 9.sp,
                                color = Color.Gray,
                                textAlign = TextAlign.Center
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun IdCardDataRow(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            text = label,
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            color = Color(0xFF64748B)
        )
        Text(
            text = value,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            color = Color(0xFF0F172A)
        )
    }
}
