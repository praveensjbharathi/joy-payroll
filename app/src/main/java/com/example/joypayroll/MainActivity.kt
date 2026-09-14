package com.example.joypayroll

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.viewmodel.compose.viewModel
import com.example.joypayroll.data.local.JoyPayrollDatabase
import com.example.joypayroll.data.repository.JoyPayrollRepository
import com.example.joypayroll.ui.screens.*
import com.example.joypayroll.ui.theme.JoyBlue
import com.example.joypayroll.ui.theme.JoyPayrollTheme
import com.example.joypayroll.ui.viewmodel.JoyPayrollViewModel
import com.example.joypayroll.ui.viewmodel.JoyPayrollViewModelFactory

enum class AppDestination(val label: String, val icon: ImageVector) {
    DASHBOARD("Dashboard", Icons.Default.Dashboard),
    PAYROLL("Payroll", Icons.Default.ReceiptLong),
    EMPLOYEES("Staff", Icons.Default.People),
    HOSTELS("Hostels", Icons.Default.Apartment),
    RECOVERIES("Recoveries", Icons.Default.HomeWork),
    OPERATIONS("Operations", Icons.Default.AccountBalance),
    ID_CARD("ID Card", Icons.Default.Badge)
}

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        val database = JoyPayrollDatabase.getDatabase(this, lifecycleScope)
        val repository = JoyPayrollRepository(database.payrollDao())

        setContent {
            JoyPayrollTheme {
                val viewModel: JoyPayrollViewModel = viewModel(
                    factory = JoyPayrollViewModelFactory(repository)
                )

                var currentDestination by remember { mutableStateOf(AppDestination.DASHBOARD) }

                Scaffold(
                    modifier = Modifier.fillMaxSize(),
                    topBar = {
                        @OptIn(ExperimentalMaterial3Api::class)
                        TopAppBar(
                            title = {
                                Text(
                                    text = "Joy Payroll",
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 19.sp
                                )
                            },
                            actions = {
                                FilledTonalIconButton(
                                    onClick = { currentDestination = AppDestination.ID_CARD },
                                    modifier = Modifier.size(36.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Badge,
                                        contentDescription = "My Badge",
                                        modifier = Modifier.size(18.dp)
                                    )
                                }
                            },
                            colors = TopAppBarDefaults.topAppBarColors(
                                containerColor = MaterialTheme.colorScheme.surface,
                                titleContentColor = JoyBlue
                            )
                        )
                    },
                    bottomBar = {
                        NavigationBar(
                            containerColor = MaterialTheme.colorScheme.surface,
                            tonalElevation = 6.dp
                        ) {
                            AppDestination.values().forEach { destination ->
                                NavigationBarItem(
                                    selected = currentDestination == destination,
                                    onClick = { currentDestination = destination },
                                    icon = {
                                        Icon(
                                            imageVector = destination.icon,
                                            contentDescription = destination.label
                                        )
                                    },
                                    label = {
                                        Text(
                                            text = destination.label,
                                            fontSize = 10.sp,
                                            fontWeight = if (currentDestination == destination) FontWeight.Bold else FontWeight.Normal
                                        )
                                    },
                                    modifier = Modifier.testTag("nav_${destination.name.lowercase()}")
                                )
                            }
                        }
                    }
                ) { innerPadding ->
                    Surface(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(innerPadding)
                    ) {
                        when (currentDestination) {
                            AppDestination.DASHBOARD -> DashboardScreen(
                                viewModel = viewModel,
                                onNavigateToPayroll = { currentDestination = AppDestination.PAYROLL },
                                onNavigateToEmployees = { currentDestination = AppDestination.EMPLOYEES },
                                onNavigateToHostels = { currentDestination = AppDestination.HOSTELS },
                                onNavigateToRecoveries = { currentDestination = AppDestination.RECOVERIES },
                                onNavigateToIdCard = { currentDestination = AppDestination.ID_CARD }
                            )
                            AppDestination.PAYROLL -> PayrollScreen(
                                viewModel = viewModel
                            )
                            AppDestination.EMPLOYEES -> EmployeesScreen(
                                viewModel = viewModel,
                                onViewIdCard = { empId ->
                                    viewModel.setSelectedIdCardEmployeeId(empId)
                                    currentDestination = AppDestination.ID_CARD
                                }
                            )
                            AppDestination.HOSTELS -> HostelScreen(
                                viewModel = viewModel
                            )
                            AppDestination.RECOVERIES -> RecoveriesScreen(
                                viewModel = viewModel
                            )
                            AppDestination.OPERATIONS -> OperationsScreen(
                                viewModel = viewModel
                            )
                            AppDestination.ID_CARD -> IdCardScreen(
                                viewModel = viewModel
                            )
                        }
                    }
                }
            }
        }
    }
}
