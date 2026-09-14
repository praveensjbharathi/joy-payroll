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
import androidx.compose.ui.window.Dialog
import com.example.joypayroll.data.local.RoomEntity
import com.example.joypayroll.data.local.RoomRecoveryEntity
import com.example.joypayroll.ui.theme.*
import com.example.joypayroll.ui.viewmodel.JoyPayrollViewModel
import java.text.NumberFormat
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RecoveriesScreen(
    viewModel: JoyPayrollViewModel
) {
    val recoveries by viewModel.recoveries.collectAsState()
    val rooms by viewModel.rooms.collectAsState()
    val employees by viewModel.employees.collectAsState()

    var showAddRecoveryDialog by remember { mutableStateOf(false) }
    val currencyFormatter = remember { NumberFormat.getCurrencyInstance(Locale("en", "IN")) }

    Scaffold(
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = { showAddRecoveryDialog = true },
                icon = { Icon(Icons.Default.PostAdd, contentDescription = "Add Recovery") },
                text = { Text("Add Room Recovery") },
                containerColor = JoyBlue,
                contentColor = Color.White,
                modifier = Modifier.testTag("add_recovery_fab")
            )
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
                    text = "Room-Wise Recovery Ledger",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onBackground
                )
                Text(
                    text = "Gas, Ration, Provision & Electricity recovery divided among roommates",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.secondary
                )
            }

            // Recovery Entries List
            items(recoveries) { rec ->
                val roommates = employees.filter { it.roomId == rec.roomId }

                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column {
                                Text(
                                    text = rec.roomNumber,
                                    fontSize = 16.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = JoyBlue
                                )
                                Text(
                                    text = "Date: ${rec.entryDate} • Period: ${rec.monthYear}",
                                    fontSize = 11.sp,
                                    color = MaterialTheme.colorScheme.secondary
                                )
                            }

                            Card(
                                colors = CardDefaults.cardColors(containerColor = JoyBlueLight),
                                shape = RoundedCornerShape(8.dp)
                            ) {
                                Text(
                                    text = "${currencyFormatter.format(rec.perHeadAmount)} / head",
                                    fontWeight = FontWeight.Bold,
                                    color = JoyBlueDark,
                                    fontSize = 12.sp,
                                    modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp)
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(10.dp))
                        HorizontalDivider(color = MaterialTheme.colorScheme.surfaceVariant)
                        Spacer(modifier = Modifier.height(10.dp))

                        // Recovery Sub-components Grid
                        Row(modifier = Modifier.fillMaxWidth()) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text("Gas", fontSize = 11.sp, color = MaterialTheme.colorScheme.secondary)
                                Text(currencyFormatter.format(rec.gasAmount), fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                            }
                            Column(modifier = Modifier.weight(1f)) {
                                Text("Ration", fontSize = 11.sp, color = MaterialTheme.colorScheme.secondary)
                                Text(currencyFormatter.format(rec.rationAmount), fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                            }
                            Column(modifier = Modifier.weight(1f)) {
                                Text("Provision", fontSize = 11.sp, color = MaterialTheme.colorScheme.secondary)
                                Text(currencyFormatter.format(rec.provisionAmount), fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                            }
                            Column(modifier = Modifier.weight(1f), horizontalAlignment = Alignment.End) {
                                Text("Room Total", fontSize = 11.sp, color = MaterialTheme.colorScheme.secondary)
                                Text(
                                    currencyFormatter.format(rec.totalRoomRecovery),
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = WarningOrange
                                )
                            }
                        }

                        if (roommates.isNotEmpty()) {
                            Spacer(modifier = Modifier.height(10.dp))
                            Text(
                                text = "Shared by (${roommates.size} roommates): " + roommates.joinToString(", ") { it.name },
                                fontSize = 11.sp,
                                color = MaterialTheme.colorScheme.secondary
                            )
                        }
                    }
                }
            }
        }
    }

    if (showAddRecoveryDialog) {
        AddRecoveryDialog(
            rooms = rooms,
            employees = employees,
            onDismiss = { showAddRecoveryDialog = false },
            onAdd = { roomId, roomNum, gas, ration, prov, elec, count, date ->
                viewModel.addRoomRecovery(roomId, roomNum, gas, ration, prov, elec, count, date)
                showAddRecoveryDialog = false
            }
        )
    }
}

@Composable
fun AddRecoveryDialog(
    rooms: List<RoomEntity>,
    employees: List<com.example.joypayroll.data.local.EmployeeEntity>,
    onDismiss: () -> Unit,
    onAdd: (roomId: String, roomNumber: String, gas: Double, ration: Double, prov: Double, elec: Double, roommates: Int, date: String) -> Unit
) {
    var selectedRoomId by remember { mutableStateOf(rooms.firstOrNull()?.id ?: "") }
    var gasText by remember { mutableStateOf("600") }
    var rationText by remember { mutableStateOf("450") }
    var provisionText by remember { mutableStateOf("400") }
    var electricityText by remember { mutableStateOf("0") }
    var dateText by remember { mutableStateOf("2026-03-12") }

    val selectedRoom = rooms.find { it.id == selectedRoomId }
    val occupants = employees.filter { it.roomId == selectedRoomId }
    val count = if (occupants.isNotEmpty()) occupants.size else (selectedRoom?.currentOccupancy ?: 1)

    val gas = gasText.toDoubleOrNull() ?: 0.0
    val ration = rationText.toDoubleOrNull() ?: 0.0
    val prov = provisionText.toDoubleOrNull() ?: 0.0
    val elec = electricityText.toDoubleOrNull() ?: 0.0
    val total = gas + ration + prov + elec
    val perHead = if (count > 0) total / count else 0.0

    val currencyFormatter = remember { NumberFormat.getCurrencyInstance(Locale("en", "IN")) }

    Dialog(onDismissRequest = onDismiss) {
        Card(
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
                    Text("Add Room Monthly Recovery", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = JoyBlue)
                }

                item {
                    Text("Select Target Room:", fontSize = 12.sp, color = MaterialTheme.colorScheme.secondary)
                    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        rooms.take(4).forEach { r ->
                            FilterChip(
                                selected = selectedRoomId == r.id,
                                onClick = { selectedRoomId = r.id },
                                label = { Text("${r.roomNumber} (${r.hostelName})") }
                            )
                        }
                    }
                }

                item {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = gasText,
                            onValueChange = { gasText = it },
                            label = { Text("Gas (₹)") },
                            modifier = Modifier.weight(1f),
                            singleLine = true
                        )
                        OutlinedTextField(
                            value = rationText,
                            onValueChange = { rationText = it },
                            label = { Text("Ration (₹)") },
                            modifier = Modifier.weight(1f),
                            singleLine = true
                        )
                    }
                }

                item {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedTextField(
                            value = provisionText,
                            onValueChange = { provisionText = it },
                            label = { Text("Provision (₹)") },
                            modifier = Modifier.weight(1f),
                            singleLine = true
                        )
                        OutlinedTextField(
                            value = electricityText,
                            onValueChange = { electricityText = it },
                            label = { Text("Electricity (₹)") },
                            modifier = Modifier.weight(1f),
                            singleLine = true
                        )
                    }
                }

                item {
                    Card(
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
                        shape = RoundedCornerShape(10.dp)
                    ) {
                        Column(modifier = Modifier.padding(12.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween
                            ) {
                                Text("Room Total: ${currencyFormatter.format(total)}", fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                                Text("$count Roommates", fontSize = 12.sp, color = JoyBlue, fontWeight = FontWeight.Bold)
                            }
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                "Per Head Deduction: ${currencyFormatter.format(perHead)}",
                                fontWeight = FontWeight.Bold,
                                fontSize = 14.sp,
                                color = WarningOrange
                            )
                        }
                    }
                }

                item {
                    Spacer(modifier = Modifier.height(6.dp))
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                        TextButton(onClick = onDismiss) { Text("Cancel") }
                        Spacer(modifier = Modifier.width(8.dp))
                        Button(
                            onClick = {
                                if (selectedRoom != null) {
                                    onAdd(selectedRoom.id, selectedRoom.roomNumber, gas, ration, prov, elec, count, dateText)
                                }
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = JoyBlue)
                        ) {
                            Text("Post Recovery")
                        }
                    }
                }
            }
        }
    }
}
