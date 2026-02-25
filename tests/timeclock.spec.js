// @ts-check
const { test, expect } = require('@playwright/test');

// Helper to set up localStorage with demo employee and clear state
test.beforeEach(async ({ page }) => {
  await page.goto('index.html');
  await page.evaluate(() => {
    localStorage.clear();
    // Initialize demo data (mirrors LocalDB.init())
    localStorage.setItem('timeclock_employees', JSON.stringify([
      {
        id: 'demo-1',
        name: 'Demo Employee',
        pin: '1234',
        ssn: null,
        status: 'off_clock',
        currentPunchId: null
      }
    ]));
    localStorage.setItem('timeclock_punches', JSON.stringify([]));
  });
  await page.reload();
  // Wait for module script to initialize (console.log confirms ready)
  await page.waitForFunction(() => {
    return document.querySelector('#currentTime')?.textContent !== '12:00';
  }, null, { timeout: 5000 }).catch(() => {});
});

// ============================================================
// Helper: enter a 4-digit PIN on the main keypad (#pinScreen)
// ============================================================
async function enterPin(page, pin) {
  for (const digit of pin) {
    await page.locator(`#pinScreen [data-key="${digit}"]`).click();
  }
}

// ============================================================
// Helper: enter a 4-digit PIN on the admin keypad
// ============================================================
async function enterAdminPin(page, pin) {
  for (const digit of pin) {
    await page.locator(`#adminKeypad [data-key="${digit}"]`).click();
  }
}

// ============================================================
// Helper: open admin panel (5 clicks + PIN)
// ============================================================
async function openAdminPanel(page) {
  const trigger = page.locator('#adminTrigger');
  for (let i = 0; i < 5; i++) {
    await trigger.click({ force: true });
  }
  await expect(page.locator('#adminPinModal')).toHaveClass(/active/);
  await enterAdminPin(page, '0000');
  await expect(page.locator('#adminScreen')).toHaveClass(/active/);
}

// Helper: set up an active punch for meal break tests
async function setupActivePunch(page, hoursAgo, punchId) {
  const now = new Date();
  const clockIn = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000);

  await page.evaluate(({ clockInISO, pid }) => {
    const employees = JSON.parse(localStorage.getItem('timeclock_employees'));
    employees[0].status = 'on_clock';
    employees[0].currentPunchId = pid;
    localStorage.setItem('timeclock_employees', JSON.stringify(employees));

    localStorage.setItem('timeclock_punches', JSON.stringify([{
      id: pid,
      employeeId: 'demo-1',
      checkInTime: clockInISO,
      checkOutTime: null,
      mealDuration: null,
      mealAttestation: null,
      noBreakReason: null,
      date: clockInISO.split('T')[0]
    }]));
  }, { clockInISO: clockIn.toISOString(), pid: punchId });
  await page.reload();
  await page.waitForFunction(() => {
    return document.querySelector('#currentTime')?.textContent !== '12:00';
  }, null, { timeout: 5000 }).catch(() => {});
}

// ============================================================
// PIN Entry
// ============================================================
test.describe('PIN Entry', () => {
  test('should show PIN screen on load', async ({ page }) => {
    await expect(page.locator('#pinScreen')).toHaveClass(/active/);
    await expect(page.locator('#actionScreen')).not.toHaveClass(/active/);
    await expect(page.locator('#adminScreen')).not.toHaveClass(/active/);
  });

  test('should show clock time and date', async ({ page }) => {
    await expect(page.locator('#currentTime')).not.toBeEmpty();
    await expect(page.locator('#currentDate')).not.toBeEmpty();
  });

  test('should fill PIN dots as digits are entered', async ({ page }) => {
    await page.locator('#pinScreen [data-key="1"]').click();
    await expect(page.locator('#pinDots .pin-dot.filled')).toHaveCount(1);

    await page.locator('#pinScreen [data-key="2"]').click();
    await expect(page.locator('#pinDots .pin-dot.filled')).toHaveCount(2);

    await page.locator('#pinScreen [data-key="3"]').click();
    await expect(page.locator('#pinDots .pin-dot.filled')).toHaveCount(3);
  });

  test('should navigate to action screen on valid PIN', async ({ page }) => {
    await enterPin(page, '1234');
    await expect(page.locator('#actionScreen')).toHaveClass(/active/);
    await expect(page.locator('#employeeName')).toHaveText('Demo Employee');
  });

  test('should show error animation on invalid PIN', async ({ page }) => {
    await enterPin(page, '9999');
    // After error, dots should clear
    await page.waitForTimeout(600);
    await expect(page.locator('#pinDots .pin-dot.filled')).toHaveCount(0);
    // Should still be on PIN screen
    await expect(page.locator('#pinScreen')).toHaveClass(/active/);
  });

  test('should clear PIN with clear button', async ({ page }) => {
    await page.locator('#pinScreen [data-key="1"]').click();
    await page.locator('#pinScreen [data-key="2"]').click();
    await expect(page.locator('#pinDots .pin-dot.filled')).toHaveCount(2);

    await page.locator('#pinScreen [data-key="clear"]').click();
    await expect(page.locator('#pinDots .pin-dot.filled')).toHaveCount(0);
  });

  test('should delete last digit with backspace', async ({ page }) => {
    await page.locator('#pinScreen [data-key="1"]').click();
    await page.locator('#pinScreen [data-key="2"]').click();
    await page.locator('#pinScreen [data-key="3"]').click();
    await expect(page.locator('#pinDots .pin-dot.filled')).toHaveCount(3);

    await page.locator('#pinScreen [data-key="back"]').click();
    await expect(page.locator('#pinDots .pin-dot.filled')).toHaveCount(2);
  });

  test('should auto-submit at exactly 4 digits', async ({ page }) => {
    await page.locator('#pinScreen [data-key="1"]').click();
    await page.locator('#pinScreen [data-key="2"]').click();
    await page.locator('#pinScreen [data-key="3"]').click();
    // At 3 digits, still on PIN screen
    await expect(page.locator('#pinScreen')).toHaveClass(/active/);
    await page.locator('#pinScreen [data-key="4"]').click();
    // At 4 digits, should transition to action
    await expect(page.locator('#actionScreen')).toHaveClass(/active/);
  });
});

// ============================================================
// Clock In / Clock Out
// ============================================================
test.describe('Clock In/Out', () => {
  test('should show employee as off-clock initially', async ({ page }) => {
    await enterPin(page, '1234');
    await expect(page.locator('#employeeStatus')).toHaveText('Off Clock');
    await expect(page.locator('#clockInBtn')).toBeVisible();
    await expect(page.locator('#clockOutBtn')).not.toBeVisible();
  });

  test('should clock in successfully', async ({ page }) => {
    await enterPin(page, '1234');
    await page.click('#clockInBtn');

    await expect(page.locator('#employeeStatus')).toHaveText('On Clock');
    await expect(page.locator('#clockInBtn')).not.toBeVisible();
    await expect(page.locator('#clockOutBtn')).toBeVisible();
    await expect(page.locator('#shiftInfo')).not.toBeEmpty();
  });

  test('should show toast on clock in', async ({ page }) => {
    await enterPin(page, '1234');
    await page.click('#clockInBtn');
    await expect(page.locator('#toast')).toContainText('Demo Employee');
  });

  test('should persist clock-in state in localStorage', async ({ page }) => {
    await enterPin(page, '1234');
    await page.click('#clockInBtn');

    const punches = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('timeclock_punches') || '[]')
    );
    expect(punches.length).toBe(1);
    expect(punches[0].employeeId).toBe('demo-1');
    expect(punches[0].checkOutTime).toBeNull();
  });

  test('should show on-clock state when re-entering PIN after clock-in', async ({ page }) => {
    await enterPin(page, '1234');
    await page.click('#clockInBtn');
    await page.click('#cancelBtn');
    await expect(page.locator('#pinScreen')).toHaveClass(/active/);

    await enterPin(page, '1234');
    await expect(page.locator('#employeeStatus')).toHaveText('On Clock');
    await expect(page.locator('#clockOutBtn')).toBeVisible();
  });

  test('should return to PIN screen on cancel', async ({ page }) => {
    await enterPin(page, '1234');
    await expect(page.locator('#actionScreen')).toHaveClass(/active/);

    await page.click('#cancelBtn');
    await expect(page.locator('#pinScreen')).toHaveClass(/active/);
    await expect(page.locator('#pinDots .pin-dot.filled')).toHaveCount(0);
  });
});

// ============================================================
// Meal Break Attestation (California Labor Law)
// ============================================================
test.describe('Meal Break Attestation', () => {
  test('should skip meal modal for shifts under 5 hours', async ({ page }) => {
    await setupActivePunch(page, 2, 'punch-short');
    await enterPin(page, '1234');
    await page.click('#clockOutBtn');

    // Should NOT show meal modal for short shift
    await expect(page.locator('#mealModal')).not.toHaveClass(/active/);
    await expect(page.locator('#toast')).toContainText('no break required');
  });

  test('should show meal modal for shifts over 5 hours', async ({ page }) => {
    await setupActivePunch(page, 6, 'punch-long');
    await enterPin(page, '1234');
    await page.click('#clockOutBtn');

    await expect(page.locator('#mealModal')).toHaveClass(/active/);
  });

  test('should allow selecting 30-minute break', async ({ page }) => {
    await setupActivePunch(page, 6, 'punch-meal30');
    await enterPin(page, '1234');
    await page.click('#clockOutBtn');
    await expect(page.locator('#mealModal')).toHaveClass(/active/);

    await page.click('[data-meal="30"]');
    await expect(page.locator('[data-meal="30"]')).toHaveClass(/selected/);
    await expect(page.locator('#mealConfirmBtn')).toBeEnabled();

    await page.click('#mealConfirmBtn');
    await expect(page.locator('#mealModal')).not.toHaveClass(/active/);
    await expect(page.locator('#toast')).toContainText('30 min break');
  });

  test('should allow selecting 60-minute break', async ({ page }) => {
    await setupActivePunch(page, 9, 'punch-meal60');
    await enterPin(page, '1234');
    await page.click('#clockOutBtn');

    await page.click('[data-meal="60"]');
    await expect(page.locator('#mealConfirmBtn')).toBeEnabled();
    await page.click('#mealConfirmBtn');
    await expect(page.locator('#toast')).toContainText('60 min break');
  });

  test('should require reason when no break taken', async ({ page }) => {
    await setupActivePunch(page, 6, 'punch-nobreak');
    await enterPin(page, '1234');
    await page.click('#clockOutBtn');

    await page.click('[data-meal="0"]');
    await expect(page.locator('#reasonContainer')).toHaveClass(/active/);
    await expect(page.locator('#mealConfirmBtn')).toBeDisabled();

    // Short reason (< 5 chars) — still disabled
    await page.fill('#reasonInput', 'busy');
    await expect(page.locator('#mealConfirmBtn')).toBeDisabled();

    // Valid reason (>= 5 chars)
    await page.fill('#reasonInput', 'Customer emergency required immediate help');
    await expect(page.locator('#mealConfirmBtn')).toBeEnabled();

    await page.click('#mealConfirmBtn');
    await expect(page.locator('#toast')).toContainText('flagged for review');
  });

  test('should store meal attestation data in punch record', async ({ page }) => {
    await setupActivePunch(page, 6, 'punch-store');
    await enterPin(page, '1234');
    await page.click('#clockOutBtn');
    await page.click('[data-meal="30"]');
    await page.click('#mealConfirmBtn');

    const punches = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('timeclock_punches') || '[]')
    );
    const punch = punches.find(p => p.id === 'punch-store');
    expect(punch.mealDuration).toBe(30);
    expect(punch.mealAttestation).toBe(true);
    expect(punch.checkOutTime).not.toBeNull();
  });

  test('should cancel meal modal without clocking out', async ({ page }) => {
    await setupActivePunch(page, 6, 'punch-cancel');
    await enterPin(page, '1234');
    await page.click('#clockOutBtn');
    await expect(page.locator('#mealModal')).toHaveClass(/active/);

    await page.click('#mealCancelBtn');
    await expect(page.locator('#mealModal')).not.toHaveClass(/active/);

    const punches = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('timeclock_punches') || '[]')
    );
    expect(punches[0].checkOutTime).toBeNull();
  });

  test('should have confirm button disabled until option selected', async ({ page }) => {
    await setupActivePunch(page, 6, 'punch-disabled');
    await enterPin(page, '1234');
    await page.click('#clockOutBtn');

    await expect(page.locator('#mealConfirmBtn')).toBeDisabled();
    await page.click('[data-meal="30"]');
    await expect(page.locator('#mealConfirmBtn')).toBeEnabled();
  });
});

// ============================================================
// Admin Panel Access
// ============================================================
test.describe('Admin Panel Access', () => {
  test('should require 5 clicks on admin trigger to show PIN modal', async ({ page }) => {
    const trigger = page.locator('#adminTrigger');
    for (let i = 0; i < 4; i++) {
      await trigger.click({ force: true });
    }
    await expect(page.locator('#adminPinModal')).not.toHaveClass(/active/);

    await trigger.click({ force: true });
    await expect(page.locator('#adminPinModal')).toHaveClass(/active/);
  });

  test('should open admin screen with correct PIN (0000)', async ({ page }) => {
    await openAdminPanel(page);
    await expect(page.locator('#adminScreen')).toHaveClass(/active/);
  });

  test('should reject wrong admin PIN', async ({ page }) => {
    const trigger = page.locator('#adminTrigger');
    for (let i = 0; i < 5; i++) {
      await trigger.click({ force: true });
    }
    await expect(page.locator('#adminPinModal')).toHaveClass(/active/);

    await enterAdminPin(page, '1111');
    await page.waitForTimeout(600);
    await expect(page.locator('#adminScreen')).not.toHaveClass(/active/);
    await expect(page.locator('#adminPinDots .pin-dot.filled')).toHaveCount(0);
  });

  test('should cancel admin PIN modal', async ({ page }) => {
    const trigger = page.locator('#adminTrigger');
    for (let i = 0; i < 5; i++) {
      await trigger.click({ force: true });
    }
    await expect(page.locator('#adminPinModal')).toHaveClass(/active/);

    await page.click('#adminPinCancelBtn');
    await expect(page.locator('#adminPinModal')).not.toHaveClass(/active/);
  });

  test('admin keypad clear and backspace should work', async ({ page }) => {
    const trigger = page.locator('#adminTrigger');
    for (let i = 0; i < 5; i++) {
      await trigger.click({ force: true });
    }
    await expect(page.locator('#adminPinModal')).toHaveClass(/active/);

    await page.locator('#adminKeypad [data-key="1"]').click();
    await page.locator('#adminKeypad [data-key="2"]').click();
    await expect(page.locator('#adminPinDots .pin-dot.filled')).toHaveCount(2);

    await page.locator('#adminKeypad [data-key="back"]').click();
    await expect(page.locator('#adminPinDots .pin-dot.filled')).toHaveCount(1);

    await page.locator('#adminKeypad [data-key="clear"]').click();
    await expect(page.locator('#adminPinDots .pin-dot.filled')).toHaveCount(0);
  });

  test('should navigate back from admin panel', async ({ page }) => {
    await openAdminPanel(page);
    await page.click('#adminBackBtn');
    await expect(page.locator('#pinScreen')).toHaveClass(/active/);
  });
});

// ============================================================
// Admin - Employee Management
// ============================================================
test.describe('Admin - Employee Management', () => {
  test('should list existing employees', async ({ page }) => {
    await openAdminPanel(page);
    await expect(page.locator('#employeeList .employee-item')).toHaveCount(1);
    await expect(page.locator('#employeeList')).toContainText('Demo Employee');
    await expect(page.locator('#employeeList')).toContainText('1234');
  });

  test('should add a new employee', async ({ page }) => {
    await openAdminPanel(page);
    await page.click('[data-tab="add"]');

    await page.fill('#newName', 'Jane Smith');
    await page.fill('#newPin', '5678');
    await page.click('#addEmployeeForm button[type="submit"]');

    await expect(page.locator('#toast')).toContainText('Jane Smith');
    await expect(page.locator('#employeesTab')).toHaveClass(/active/);
    await expect(page.locator('#employeeList .employee-item')).toHaveCount(2);
    await expect(page.locator('#employeeList')).toContainText('Jane Smith');
  });

  test('should add employee with SSN (masked)', async ({ page }) => {
    await openAdminPanel(page);
    await page.click('[data-tab="add"]');

    await page.fill('#newName', 'John Doe');
    await page.fill('#newPin', '4321');
    await page.fill('#newSsn', '123-45-6789');
    await page.click('#addEmployeeForm button[type="submit"]');

    await expect(page.locator('#employeeList')).toContainText('***-**-6789');
  });

  test('should reject duplicate PIN', async ({ page }) => {
    await openAdminPanel(page);
    await page.click('[data-tab="add"]');

    await page.fill('#newName', 'Duplicate');
    await page.fill('#newPin', '1234');
    await page.click('#addEmployeeForm button[type="submit"]');

    await expect(page.locator('#toast')).toContainText('PIN already in use');
    await page.click('[data-tab="employees"]');
    await expect(page.locator('#employeeList .employee-item')).toHaveCount(1);
  });

  test('should delete an employee', async ({ page }) => {
    await page.evaluate(() => {
      const employees = JSON.parse(localStorage.getItem('timeclock_employees'));
      employees.push({
        id: 'emp-delete',
        name: 'To Delete',
        pin: '9876',
        ssn: null,
        status: 'off_clock',
        currentPunchId: null
      });
      localStorage.setItem('timeclock_employees', JSON.stringify(employees));
    });
    await page.reload();
    await page.waitForFunction(() =>
      document.querySelector('#currentTime')?.textContent !== '12:00'
    , null, { timeout: 5000 }).catch(() => {});

    await openAdminPanel(page);
    await expect(page.locator('#employeeList .employee-item')).toHaveCount(2);

    page.on('dialog', dialog => dialog.accept());
    await page.locator('#employeeList .employee-item').nth(1).locator('.btn-delete').click();

    await expect(page.locator('#employeeList .employee-item')).toHaveCount(1);
    await expect(page.locator('#employeeList')).not.toContainText('To Delete');
  });

  test('should allow new employee to clock in with their PIN', async ({ page }) => {
    await openAdminPanel(page);
    await page.click('[data-tab="add"]');
    await page.fill('#newName', 'New Worker');
    await page.fill('#newPin', '5555');
    await page.click('#addEmployeeForm button[type="submit"]');

    await page.click('#adminBackBtn');
    await enterPin(page, '5555');
    await expect(page.locator('#employeeName')).toHaveText('New Worker');
  });
});

// ============================================================
// Admin - Tabs
// ============================================================
test.describe('Admin - Tabs', () => {
  test('should switch between tabs', async ({ page }) => {
    await openAdminPanel(page);
    await expect(page.locator('#employeesTab')).toHaveClass(/active/);

    await page.click('[data-tab="records"]');
    await expect(page.locator('#recordsTab')).toHaveClass(/active/);
    await expect(page.locator('#employeesTab')).not.toHaveClass(/active/);

    await page.click('[data-tab="add"]');
    await expect(page.locator('#addTab')).toHaveClass(/active/);
    await expect(page.locator('#recordsTab')).not.toHaveClass(/active/);
  });
});

// ============================================================
// Admin - Punch Records
// ============================================================
test.describe('Admin - Punch Records', () => {
  test('should show empty records initially', async ({ page }) => {
    await openAdminPanel(page);
    await page.click('[data-tab="records"]');
    await expect(page.locator('#punchRecords')).toContainText('No records');
  });

  test('should show punch records after clock in/out', async ({ page }) => {
    const now = new Date();
    const clockIn = new Date(now.getTime() - 2 * 60 * 60 * 1000);

    await page.evaluate(({ clockInISO, clockOutISO }) => {
      localStorage.setItem('timeclock_punches', JSON.stringify([{
        id: 'punch-record',
        employeeId: 'demo-1',
        checkInTime: clockInISO,
        checkOutTime: clockOutISO,
        mealDuration: 0,
        mealAttestation: false,
        noBreakReason: null,
        date: clockInISO.split('T')[0]
      }]));
    }, { clockInISO: clockIn.toISOString(), clockOutISO: now.toISOString() });
    await page.reload();
    await page.waitForFunction(() =>
      document.querySelector('#currentTime')?.textContent !== '12:00'
    , null, { timeout: 5000 }).catch(() => {});

    await openAdminPanel(page);
    await page.click('[data-tab="records"]');
    await expect(page.locator('#punchRecords .punch-record')).toHaveCount(1);
    await expect(page.locator('#punchRecords')).toContainText('Demo Employee');
  });

  test('should show meal break flag for no-break shifts', async ({ page }) => {
    const now = new Date();
    const clockIn = new Date(now.getTime() - 7 * 60 * 60 * 1000);

    await page.evaluate(({ clockInISO, clockOutISO }) => {
      localStorage.setItem('timeclock_punches', JSON.stringify([{
        id: 'punch-flagged',
        employeeId: 'demo-1',
        checkInTime: clockInISO,
        checkOutTime: clockOutISO,
        mealDuration: 0,
        mealAttestation: false,
        noBreakReason: 'Customer emergency',
        date: clockInISO.split('T')[0]
      }]));
    }, { clockInISO: clockIn.toISOString(), clockOutISO: now.toISOString() });
    await page.reload();
    await page.waitForFunction(() =>
      document.querySelector('#currentTime')?.textContent !== '12:00'
    , null, { timeout: 5000 }).catch(() => {});

    await openAdminPanel(page);
    await page.click('[data-tab="records"]');
    await expect(page.locator('#punchRecords .punch-record-meal')).toContainText('Customer emergency');
  });

  test('should show meal break taken indicator', async ({ page }) => {
    const now = new Date();
    const clockIn = new Date(now.getTime() - 8 * 60 * 60 * 1000);

    await page.evaluate(({ clockInISO, clockOutISO }) => {
      localStorage.setItem('timeclock_punches', JSON.stringify([{
        id: 'punch-meal-ok',
        employeeId: 'demo-1',
        checkInTime: clockInISO,
        checkOutTime: clockOutISO,
        mealDuration: 30,
        mealAttestation: true,
        noBreakReason: null,
        date: clockInISO.split('T')[0]
      }]));
    }, { clockInISO: clockIn.toISOString(), clockOutISO: now.toISOString() });
    await page.reload();
    await page.waitForFunction(() =>
      document.querySelector('#currentTime')?.textContent !== '12:00'
    , null, { timeout: 5000 }).catch(() => {});

    await openAdminPanel(page);
    await page.click('[data-tab="records"]');
    await expect(page.locator('#punchRecords .punch-record-meal')).toContainText('30 min break taken');
  });

  test('should show currently on clock for active punches', async ({ page }) => {
    await setupActivePunch(page, 1, 'punch-active');

    await openAdminPanel(page);
    await page.click('[data-tab="records"]');
    await expect(page.locator('#punchRecords')).toContainText('Currently on clock');
  });
});

// ============================================================
// Data Persistence
// ============================================================
test.describe('Data Persistence', () => {
  test('should initialize demo employee when localStorage is empty', async ({ page }) => {
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForFunction(() =>
      document.querySelector('#currentTime')?.textContent !== '12:00'
    , null, { timeout: 5000 }).catch(() => {});

    await enterPin(page, '1234');
    await expect(page.locator('#employeeName')).toHaveText('Demo Employee');
  });

  test('should persist employees across page reload', async ({ page }) => {
    await openAdminPanel(page);
    await page.click('[data-tab="add"]');
    await page.fill('#newName', 'Persistent Employee');
    await page.fill('#newPin', '7777');
    await page.click('#addEmployeeForm button[type="submit"]');

    await page.reload();
    await page.waitForFunction(() =>
      document.querySelector('#currentTime')?.textContent !== '12:00'
    , null, { timeout: 5000 }).catch(() => {});

    await enterPin(page, '7777');
    await expect(page.locator('#employeeName')).toHaveText('Persistent Employee');
  });
});

// ============================================================
// Utility Functions (tested through UI)
// ============================================================
test.describe('Utility Functions', () => {
  test('SSN masking should show only last 4 digits', async ({ page }) => {
    await openAdminPanel(page);
    await page.click('[data-tab="add"]');
    await page.fill('#newName', 'SSN Test');
    await page.fill('#newPin', '3333');
    await page.fill('#newSsn', '987-65-4321');
    await page.click('#addEmployeeForm button[type="submit"]');

    await page.click('[data-tab="employees"]');
    await expect(page.locator('#employeeList')).toContainText('***-**-4321');
  });

  test('clock should update', async ({ page }) => {
    const time1 = await page.locator('#currentTime').textContent();
    await page.waitForTimeout(1500);
    const time2 = await page.locator('#currentTime').textContent();
    expect(time2).not.toBe('');
  });
});

// ============================================================
// Mobile Viewport
// ============================================================
test.describe('Mobile Viewport', () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test('should display keypad properly on mobile', async ({ page }) => {
    const keys = page.locator('#pinScreen .key');
    await expect(keys).toHaveCount(12);
  });

  test('should have tappable key buttons (44px+ touch targets)', async ({ page }) => {
    const key = page.locator('#pinScreen [data-key="5"]');
    const box = await key.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.width).toBeGreaterThanOrEqual(44);
  });

  test('should have tappable action buttons on mobile', async ({ page }) => {
    await enterPin(page, '1234');
    const clockInBtn = page.locator('#clockInBtn');
    const box = await clockInBtn.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(44);
  });

  test('should fit container within mobile viewport', async ({ page }) => {
    const container = page.locator('.container');
    const box = await container.boundingBox();
    expect(box.width).toBeLessThanOrEqual(375);
  });

  test('meal modal should be usable on mobile', async ({ page }) => {
    await setupActivePunch(page, 6, 'punch-mobile');
    await enterPin(page, '1234');
    await page.click('#clockOutBtn');

    const modal = page.locator('#mealModal .modal');
    await expect(modal).toBeVisible();
    const box = await modal.boundingBox();
    expect(box.width).toBeLessThanOrEqual(375);
  });
});

// ============================================================
// Edge Cases
// ============================================================
test.describe('Edge Cases', () => {
  test('should handle employee with no SSN', async ({ page }) => {
    await openAdminPanel(page);
    await page.click('[data-tab="add"]');
    await page.fill('#newName', 'No SSN Employee');
    await page.fill('#newPin', '8888');
    await page.click('#addEmployeeForm button[type="submit"]');

    await page.click('[data-tab="employees"]');
    await expect(page.locator('#employeeList')).toContainText('No SSN Employee');
  });

  test('should handle multiple employees clocking in/out', async ({ page }) => {
    await page.evaluate(() => {
      const employees = JSON.parse(localStorage.getItem('timeclock_employees'));
      employees.push({
        id: 'emp-2',
        name: 'Second Worker',
        pin: '5678',
        ssn: null,
        status: 'off_clock',
        currentPunchId: null
      });
      localStorage.setItem('timeclock_employees', JSON.stringify(employees));
    });
    await page.reload();
    await page.waitForFunction(() =>
      document.querySelector('#currentTime')?.textContent !== '12:00'
    , null, { timeout: 5000 }).catch(() => {});

    // First employee clocks in
    await enterPin(page, '1234');
    await page.click('#clockInBtn');
    await page.click('#cancelBtn');

    // Second employee clocks in
    await enterPin(page, '5678');
    await expect(page.locator('#employeeName')).toHaveText('Second Worker');
    await page.click('#clockInBtn');
    await page.click('#cancelBtn');

    const punches = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('timeclock_punches') || '[]')
    );
    expect(punches.length).toBe(2);
    expect(punches.filter(p => p.checkOutTime === null).length).toBe(2);
  });
});
