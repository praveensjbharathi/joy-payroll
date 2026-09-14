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
import com.example.joypayroll.data.local.HostelEntity
import com.example.joypayroll.data.local.RoomEntity
import com.example.joypayroll.ui.theme.*
import com.example.joypayroll.ui.viewmodel.JoyPayrollViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HostelScreen(
    viewModel: JoyPayrollViewModel
) {
    val hostels by viewModel.hostels.collectAsState()
    val rooms by viewModel.rooms.collectAsState()
    val employees by viewModel.employees.collectAsState()

    var showAddHostelDialog by remember { mutableStateOf(false) }
    var showAddRoomDialog by remember { mutableStateOf(false) }

    Scaffold(
        floatingActionButton = {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilledTonalButton(
                    onClick = { showAddRoomDialog = true },
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Icon(Icons.Default.Add, contentDescription = "Add Room", modifier = Modifier.size(16.dp))
                    Spacer(modifier = Modifier.width(4.dp))
                    Text("Add Room")
                }
                ExtendedFloatingActionButton(
                    onClick = { showAddHostelDialog = true },
                    icon = { Icon(Icons.Default.DomainAdd, contentDescription = "Add Hostel") },
                    text = { Text("Add Hostel") },
                    containerColor = JoyBlue,
                    contentColor = Color.White,
                    modifier = Modifier.testTag("add_hostel_fab")
                )
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
                    text = "Hostel & Accommodation Master",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    color = MaterialTheme.colorScheme.onBackground
                )
                Text(
                    text = "Shared hostel facilities & room occupancy tracking",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.secondary
                )
            }

            // Hostels Summary Cards
            items(hostels) { hostel ->
                val hostelRooms = rooms.filter { it.hostelId == hostel.id }
                val totalBeds = hostelRooms.sumOf { it.bedCapacity }
                val totalOccupants = hostelRooms.sumOf { it.currentOccupancy }

                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
                    shape = RoundedCornerShape(14.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Box(
                                    modifier = Modifier
                                        .size(40.dp)
                                        .background(JoyBlueLight, RoundedCornerShape(8.dp)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(
                                        Icons.Default.Apartment,
                                        contentDescription = "Hostel",
                                        tint = JoyBlueDark,
                                        modifier = Modifier.size(22.dp)
                                    )
                                }
                                Spacer(modifier = Modifier.width(12.dp))
                                Column {
                                    Text(
                                        text = hostel.name,
                                        fontSize = 15.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                    Text(
                                        text = hostel.areaLocation,
                                        fontSize = 12.sp,
                                        color = MaterialTheme.colorScheme.secondary
                                    )
                                }
                            }

                            AssistChip(
                                onClick = {},
                                label = { Text("$totalOccupants / $totalBeds Beds") }
                            )
                        }

                        Spacer(modifier = Modifier.height(10.dp))
                        HorizontalDivider(color = MaterialTheme.colorScheme.surfaceVariant)
                        Spacer(modifier = Modifier.height(10.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                text = "Caretaker: ${hostel.caretakerName}",
                                fontSize = 12.sp,
                                color = MaterialTheme.colorScheme.onSurface
                            )
                            Text(
                                text = hostel.caretakerMobile,
                                fontSize = 12.sp,
                                color = JoyBlue,
                                fontWeight = FontWeight.Medium
                            )
                        }

                        Spacer(modifier = Modifier.height(12.dp))

                        // Rooms in this hostel
                        Text(
                            text = "Allocated Rooms (${hostelRooms.size})",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = MaterialTheme.colorScheme.secondary
                        )

                        Spacer(modifier = Modifier.height(6.dp))

                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            hostelRooms.forEach { room ->
                                val occupants = employees.filter { it.roomId == room.id }

                                Surface(
                                    modifier = Modifier.fillMaxWidth(),
                                    color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f),
                                    shape = RoundedCornerShape(8.dp)
                                ) {
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(10.dp),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Column {
                                            Text(
                                                text = "${room.roomNumber} (${room.floor})",
                                                fontWeight = FontWeight.Bold,
                                                fontSize = 13.sp
                                            )
                                            if (occupants.isNotEmpty()) {
                                                Text(
                                                    text = "Residents: " + occupants.joinToString(", ") { it.name.split(" ").first() },
                                                    fontSize = 11.sp,
                                                    color = MaterialTheme.colorScheme.secondary
                                                )
                                            } else {
                                                Text("Vacant / Ready", fontSize = 11.sp, color = SuccessGreen)
                                            }
                                        }

                                        Column(horizontalAlignment = Alignment.End) {
                                            Text(
                                                text = "${occupants.size}/${room.bedCapacity} Beds",
                                                fontSize = 12.sp,
                                                fontWeight = FontWeight.SemiBold,
                                                color = if (occupants.size >= room.bedCapacity) WarningOrange else JoyBlue
                                            )
                                            Text(
                                                text = "₹${room.baseRent.toInt()}/mo",
                                                fontSize = 11.sp,
                                                color = Color.Gray
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if (showAddHostelDialog) {
        AddHostelDialog(
            onDismiss = { showAddHostelDialog = false },
            onAdd = { name, location, roomsCount, bedsCount, caretaker, phone ->
                viewModel.addHostel(name, location, roomsCount, bedsCount, caretaker, phone)
                showAddHostelDialog = false
            }
        )
    }

    if (showAddRoomDialog) {
        AddRoomDialog(
            hostels = hostels,
            onDismiss = { showAddRoomDialog = false },
            onAdd = { hostelId, hostelName, roomNum, floor, cap, rent ->
                viewModel.addRoom(hostelId, hostelName, roomNum, floor, cap, rent)
                showAddRoomDialog = false
            }
        )
    }
}

@Composable
fun AddHostelDialog(
    onDismiss: () -> Unit,
    onAdd: (name: String, location: String, rooms: Int, beds: Int, caretaker: String, phone: String) -> Unit
) {
    var name by remember { mutableStateOf("") }
    var location by remember { mutableStateOf("") }
    var roomsCount by remember { mutableStateOf("10") }
    var bedsCount by remember { mutableStateOf("40") }
    var caretaker by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("+91 ") }

    Dialog(onDismissRequest = onDismiss) {
        Card(
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
        ) {
            Column(
                modifier = Modifier
                    .padding(20.dp)
                    .fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Text("Add New Hostel Facility", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = JoyBlue)

                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Hostel Name *") },
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = location,
                    onValueChange = { location = it },
                    label = { Text("Area / Location *") },
                    modifier = Modifier.fillMaxWidth()
                )

                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = roomsCount,
                        onValueChange = { roomsCount = it },
                        label = { Text("Total Rooms") },
                        modifier = Modifier.weight(1f)
                    )
                    OutlinedTextField(
                        value = bedsCount,
                        onValueChange = { bedsCount = it },
                        label = { Text("Total Beds") },
                        modifier = Modifier.weight(1f)
                    )
                }

                OutlinedTextField(
                    value = caretaker,
                    onValueChange = { caretaker = it },
                    label = { Text("Caretaker Name") },
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = phone,
                    onValueChange = { phone = it },
                    label = { Text("Caretaker Contact") },
                    modifier = Modifier.fillMaxWidth()
                )

                Spacer(modifier = Modifier.height(8.dp))
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                    TextButton(onClick = onDismiss) { Text("Cancel") }
                    Spacer(modifier = Modifier.width(8.dp))
                    Button(
                        onClick = {
                            if (name.isNotBlank()) {
                                onAdd(
                                    name,
                                    location,
                                    roomsCount.toIntOrNull() ?: 8,
                                    bedsCount.toIntOrNull() ?: 32,
                                    caretaker,
                                    phone
                                )
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = JoyBlue)
                    ) {
                        Text("Create Hostel")
                    }
                }
            }
        }
    }
}

@Composable
fun AddRoomDialog(
    hostels: List<HostelEntity>,
    onDismiss: () -> Unit,
    onAdd: (hostelId: String, hostelName: String, roomNumber: String, floor: String, capacity: Int, rent: Double) -> Unit
) {
    var selectedHostelId by remember { mutableStateOf(hostels.firstOrNull()?.id ?: "") }
    var roomNumber by remember { mutableStateOf("Room ") }
    var floor by remember { mutableStateOf("1st Floor") }
    var capacityText by remember { mutableStateOf("4") }
    var rentText by remember { mutableStateOf("4500") }

    val selectedHostel = hostels.find { it.id == selectedHostelId }

    Dialog(onDismissRequest = onDismiss) {
        Card(
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
        ) {
            Column(
                modifier = Modifier
                    .padding(20.dp)
                    .fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Text("Add Room to Hostel", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = JoyBlue)

                Text("Select Hostel:", fontSize = 12.sp, color = MaterialTheme.colorScheme.secondary)
                Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    hostels.forEach { h ->
                        FilterChip(
                            selected = selectedHostelId == h.id,
                            onClick = { selectedHostelId = h.id },
                            label = { Text(h.name) }
                        )
                    }
                }

                OutlinedTextField(
                    value = roomNumber,
                    onValueChange = { roomNumber = it },
                    label = { Text("Room Number (e.g. Room 203)") },
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = floor,
                    onValueChange = { floor = it },
                    label = { Text("Floor") },
                    modifier = Modifier.fillMaxWidth()
                )

                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = capacityText,
                        onValueChange = { capacityText = it },
                        label = { Text("Bed Capacity") },
                        modifier = Modifier.weight(1f)
                    )
                    OutlinedTextField(
                        value = rentText,
                        onValueChange = { rentText = it },
                        label = { Text("Base Rent (₹)") },
                        modifier = Modifier.weight(1f)
                    )
                }

                Spacer(modifier = Modifier.height(8.dp))
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                    TextButton(onClick = onDismiss) { Text("Cancel") }
                    Spacer(modifier = Modifier.width(8.dp))
                    Button(
                        onClick = {
                            if (selectedHostel != null && roomNumber.isNotBlank()) {
                                onAdd(
                                    selectedHostel.id,
                                    selectedHostel.name,
                                    roomNumber,
                                    floor,
                                    capacityText.toIntOrNull() ?: 4,
                                    rentText.toDoubleOrNull() ?: 4500.0
                                )
                            }
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = JoyBlue)
                    ) {
                        Text("Add Room")
                    }
                }
            }
        }
    }
}
