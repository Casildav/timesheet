// @ts-check
const { test, expect } = require('@playwright/test');

// Helper to clear localStorage before each test
test.beforeEach(async ({ page }) => {
  await page.goto('timesheet.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test.describe('Clock In/Out', () => {
  test('should show clocked out status initially', async ({ page }) => {
    await expect(page.locator('#status')).toHaveText('Clocked Out');
    await expect(page.locator('#clockBtn')).toHaveText('Clock In');
  });

  test('should clock in when button clicked', async ({ page }) => {
    await page.click('#clockBtn');
    
    await expect(page.locator('#status')).toHaveText('Clocked In');
    await expect(page.locator('#clockBtn')).toHaveText('Clock Out');
    await expect(page.locator('#elapsedTime')).toBeVisible();
  });

  test('should clock out and create time entry', async ({ page }) => {
    // Clock in
    await page.click('#clockBtn');
    await expect(page.locator('#status')).toHaveText('Clocked In');
    
    // Wait a moment then clock out
    await page.waitForTimeout(1000);
    await page.click('#clockBtn');
    
    await expect(page.locator('#status')).toHaveText('Clocked Out');
    await expect(page.locator('#clockBtn')).toHaveText('Clock In');
    
    // Should have created a time entry
    await expect(page.locator('#timeEntriesTable table tbody tr')).toHaveCount(1);
  });

  test('should persist clock-in state across page reload', async ({ page }) => {
    await page.click('#clockBtn');
    await expect(page.locator('#status')).toHaveText('Clocked In');
    
    await page.reload();
    
    await expect(page.locator('#status')).toHaveText('Clocked In');
    await expect(page.locator('#clockBtn')).toHaveText('Clock Out');
  });
});

test.describe('Manual Time Entry', () => {
  test('should add manual time entry', async ({ page }) => {
    const today = new Date().toISOString().split('T')[0];
    
    await page.fill('#manualDate', today);
    await page.fill('#manualClockIn', '09:00');
    await page.fill('#manualClockOut', '17:00');
    await page.click('button:has-text("Add Entry")');
    
    // Should have created a time entry
    await expect(page.locator('#timeEntriesTable table tbody tr')).toHaveCount(1);
    await expect(page.locator('#timeEntriesTable')).toContainText('8.00');
  });

  test('should reject invalid time entry (clock out before clock in)', async ({ page }) => {
    const today = new Date().toISOString().split('T')[0];
    
    page.on('dialog', dialog => dialog.accept());
    
    await page.fill('#manualDate', today);
    await page.fill('#manualClockIn', '17:00');
    await page.fill('#manualClockOut', '09:00');
    await page.click('button:has-text("Add Entry")');
    
    // Should not have created a time entry
    await expect(page.locator('#timeEntriesTable .empty-state')).toBeVisible();
  });

  test('should edit existing time entry', async ({ page }) => {
    const today = new Date().toISOString().split('T')[0];
    
    // Add entry
    await page.fill('#manualDate', today);
    await page.fill('#manualClockIn', '09:00');
    await page.fill('#manualClockOut', '17:00');
    await page.click('button:has-text("Add Entry")');
    
    // Click edit button
    await page.click('#timeEntriesTable .btn-icon.edit');
    
    // Modal should be visible
    await expect(page.locator('#editTimeModal')).toHaveClass(/active/);
    
    // Change clock out time
    await page.fill('#editTimeClockOut', '18:00');
    await page.click('#editTimeModal button:has-text("Save")');
    
    // Should show updated hours (9 hours)
    await expect(page.locator('#timeEntriesTable')).toContainText('9.00');
  });

  test('should delete time entry', async ({ page }) => {
    const today = new Date().toISOString().split('T')[0];
    
    // Add entry
    await page.fill('#manualDate', today);
    await page.fill('#manualClockIn', '09:00');
    await page.fill('#manualClockOut', '17:00');
    await page.click('button:has-text("Add Entry")');
    
    await expect(page.locator('#timeEntriesTable table tbody tr')).toHaveCount(1);
    
    // Accept confirmation dialog
    page.on('dialog', dialog => dialog.accept());
    
    // Click delete button
    await page.click('#timeEntriesTable .btn-icon.delete');
    
    // Should be empty
    await expect(page.locator('#timeEntriesTable .empty-state')).toBeVisible();
  });
});

test.describe('Expenses', () => {
  test('should add reimbursable expense', async ({ page }) => {
    const today = new Date().toISOString().split('T')[0];
    
    await page.fill('#expenseDate', today);
    await page.fill('#expenseDesc', 'Office supplies');
    await page.selectOption('#expenseType', 'reimburse');
    await page.fill('#expenseAmount', '50');
    await page.click('.expense-form button:has-text("Add")');
    
    // Should have created an expense
    await expect(page.locator('#expensesTable table tbody tr')).toHaveCount(1);
    await expect(page.locator('#expensesTable')).toContainText('Office supplies');
    await expect(page.locator('#expensesTable')).toContainText('Reimburse');
    await expect(page.locator('#expensesTable')).toContainText('+$50.00');
  });

  test('should add deductible expense', async ({ page }) => {
    const today = new Date().toISOString().split('T')[0];
    
    await page.fill('#expenseDate', today);
    await page.fill('#expenseDesc', 'Personal expense');
    await page.selectOption('#expenseType', 'deduct');
    await page.fill('#expenseAmount', '25');
    await page.click('.expense-form button:has-text("Add")');
    
    // Should have created an expense with deduct type
    await expect(page.locator('#expensesTable table tbody tr')).toHaveCount(1);
    await expect(page.locator('#expensesTable')).toContainText('Deduct');
    await expect(page.locator('#expensesTable')).toContainText('-$25.00');
  });

  test('should edit expense type', async ({ page }) => {
    const today = new Date().toISOString().split('T')[0];
    
    // Add reimbursable expense
    await page.fill('#expenseDate', today);
    await page.fill('#expenseDesc', 'Test expense');
    await page.selectOption('#expenseType', 'reimburse');
    await page.fill('#expenseAmount', '100');
    await page.click('.expense-form button:has-text("Add")');
    
    // Edit to deduct
    await page.click('#expensesTable .btn-icon.edit');
    await expect(page.locator('#editExpenseModal')).toHaveClass(/active/);
    
    await page.selectOption('#editExpenseType', 'deduct');
    await page.click('#editExpenseModal button:has-text("Save")');
    
    // Should now show as deduct
    await expect(page.locator('#expensesTable')).toContainText('Deduct');
    await expect(page.locator('#expensesTable')).toContainText('-$100.00');
  });

  test('should delete expense', async ({ page }) => {
    const today = new Date().toISOString().split('T')[0];
    
    await page.fill('#expenseDate', today);
    await page.fill('#expenseDesc', 'Test expense');
    await page.fill('#expenseAmount', '50');
    await page.click('.expense-form button:has-text("Add")');
    
    await expect(page.locator('#expensesTable table tbody tr')).toHaveCount(1);
    
    page.on('dialog', dialog => dialog.accept());
    await page.click('#expensesTable .btn-icon.delete');
    
    await expect(page.locator('#expensesTable .empty-state')).toBeVisible();
  });
});

test.describe('Summary Calculations - Protected Business Logic', () => {
  /**
   * CRITICAL: These tests verify the protected business logic
   * Formula: Total Due = Gross Earnings + Reimbursable - Deductions
   * See CLAUDE.md for business rules
   */

  test('should calculate gross earnings correctly', async ({ page }) => {
    // Set hourly rate to $50
    await page.fill('#hourlyRate', '50');
    await page.locator('#hourlyRate').blur();
    
    const today = new Date().toISOString().split('T')[0];
    
    // Add 8 hours of work
    await page.fill('#manualDate', today);
    await page.fill('#manualClockIn', '09:00');
    await page.fill('#manualClockOut', '17:00');
    await page.click('button:has-text("Add Entry")');
    
    // Gross earnings should be 8 * 50 = $400
    await expect(page.locator('#grossEarnings')).toHaveText('$400.00');
    await expect(page.locator('#totalHours')).toHaveText('8.00');
  });

  test('should add reimbursable expenses to total', async ({ page }) => {
    await page.fill('#hourlyRate', '50');
    await page.locator('#hourlyRate').blur();
    
    const today = new Date().toISOString().split('T')[0];
    
    // Add 8 hours = $400
    await page.fill('#manualDate', today);
    await page.fill('#manualClockIn', '09:00');
    await page.fill('#manualClockOut', '17:00');
    await page.click('button:has-text("Add Entry")');
    
    // Add $100 reimbursable expense
    await page.fill('#expenseDate', today);
    await page.fill('#expenseDesc', 'Travel');
    await page.selectOption('#expenseType', 'reimburse');
    await page.fill('#expenseAmount', '100');
    await page.click('.expense-form button:has-text("Add")');
    
    // Total Due = $400 + $100 = $500
    await expect(page.locator('#grossEarnings')).toHaveText('$400.00');
    await expect(page.locator('#totalReimbursable')).toHaveText('$100.00');
    await expect(page.locator('#subtotal')).toHaveText('$500.00');
  });

  test('should subtract deductible expenses from total', async ({ page }) => {
    await page.fill('#hourlyRate', '50');
    await page.locator('#hourlyRate').blur();
    
    const today = new Date().toISOString().split('T')[0];
    
    // Add 8 hours = $400
    await page.fill('#manualDate', today);
    await page.fill('#manualClockIn', '09:00');
    await page.fill('#manualClockOut', '17:00');
    await page.click('button:has-text("Add Entry")');
    
    // Add $50 deductible expense
    await page.fill('#expenseDate', today);
    await page.fill('#expenseDesc', 'Personal item');
    await page.selectOption('#expenseType', 'deduct');
    await page.fill('#expenseAmount', '50');
    await page.click('.expense-form button:has-text("Add")');
    
    // Total Due = $400 - $50 = $350
    await expect(page.locator('#grossEarnings')).toHaveText('$400.00');
    await expect(page.locator('#totalDeductions')).toHaveText('$50.00');
    await expect(page.locator('#subtotal')).toHaveText('$350.00');
  });

  test('should calculate correctly with both expense types', async ({ page }) => {
    await page.fill('#hourlyRate', '25');
    await page.locator('#hourlyRate').blur();
    
    const today = new Date().toISOString().split('T')[0];
    
    // Add 10 hours = $250
    await page.fill('#manualDate', today);
    await page.fill('#manualClockIn', '08:00');
    await page.fill('#manualClockOut', '18:00');
    await page.click('button:has-text("Add Entry")');
    
    // Add $75 reimbursable expense
    await page.fill('#expenseDate', today);
    await page.fill('#expenseDesc', 'Supplies');
    await page.selectOption('#expenseType', 'reimburse');
    await page.fill('#expenseAmount', '75');
    await page.click('.expense-form button:has-text("Add")');
    
    // Add $25 deductible expense
    await page.fill('#expenseDate', today);
    await page.fill('#expenseDesc', 'Lunch');
    await page.selectOption('#expenseType', 'deduct');
    await page.fill('#expenseAmount', '25');
    await page.click('.expense-form button:has-text("Add")');
    
    // Total Due = $250 + $75 - $25 = $300
    await expect(page.locator('#grossEarnings')).toHaveText('$250.00');
    await expect(page.locator('#totalReimbursable')).toHaveText('$75.00');
    await expect(page.locator('#totalDeductions')).toHaveText('$25.00');
    await expect(page.locator('#subtotal')).toHaveText('$300.00');
  });
});

test.describe('Daily Subtotals', () => {
  test('should show daily breakdown', async ({ page }) => {
    await page.fill('#hourlyRate', '50');
    await page.locator('#hourlyRate').blur();
    
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    // Add time entry for today
    await page.fill('#manualDate', todayStr);
    await page.fill('#manualClockIn', '09:00');
    await page.fill('#manualClockOut', '17:00');
    await page.click('button:has-text("Add Entry")');
    
    // Add expense for today
    await page.fill('#expenseDate', todayStr);
    await page.fill('#expenseDesc', 'Supplies');
    await page.selectOption('#expenseType', 'reimburse');
    await page.fill('#expenseAmount', '50');
    await page.click('.expense-form button:has-text("Add")');
    
    // Daily subtotals should show
    await expect(page.locator('#dailySubtotals .daily-item')).toHaveCount(1);
    // 8 hours * $50 + $50 reimburse = $450
    await expect(page.locator('#dailySubtotals .daily-total')).toContainText('$450.00');
  });

  test('should show multiple days', async ({ page }) => {
    await page.fill('#hourlyRate', '25');
    await page.locator('#hourlyRate').blur();
    
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    // Add entry for today
    await page.fill('#manualDate', todayStr);
    await page.fill('#manualClockIn', '09:00');
    await page.fill('#manualClockOut', '17:00');
    await page.click('button:has-text("Add Entry")');
    
    // Add entry for yesterday
    await page.fill('#manualDate', yesterdayStr);
    await page.fill('#manualClockIn', '10:00');
    await page.fill('#manualClockOut', '14:00');
    await page.click('button:has-text("Add Entry")');
    
    // Should show 2 days in breakdown
    await expect(page.locator('#dailySubtotals .daily-item')).toHaveCount(2);
  });
});

test.describe('Date Filtering', () => {
  test('should filter by this week', async ({ page }) => {
    await page.click('button:has-text("This Week")');
    
    // Filter inputs should be set
    await expect(page.locator('#filterFrom')).not.toHaveValue('');
    await expect(page.locator('#filterTo')).not.toHaveValue('');
  });

  test('should filter by this month', async ({ page }) => {
    await page.click('button:has-text("This Month")');
    
    // Filter inputs should be set
    await expect(page.locator('#filterFrom')).not.toHaveValue('');
    await expect(page.locator('#filterTo')).not.toHaveValue('');
  });

  test('should only show entries within date range', async ({ page }) => {
    await page.fill('#hourlyRate', '25');
    await page.locator('#hourlyRate').blur();
    
    // Add entry for a date in the past (outside typical filter)
    await page.fill('#manualDate', '2024-01-15');
    await page.fill('#manualClockIn', '09:00');
    await page.fill('#manualClockOut', '17:00');
    await page.click('button:has-text("Add Entry")');
    
    // Set filter to January 2024
    await page.fill('#filterFrom', '2024-01-01');
    await page.fill('#filterTo', '2024-01-31');
    
    // Should show 8 hours
    await expect(page.locator('#totalHours')).toHaveText('8.00');
    
    // Change filter to February 2024 (no entries)
    await page.fill('#filterFrom', '2024-02-01');
    await page.fill('#filterTo', '2024-02-29');
    
    // Should show 0 hours
    await expect(page.locator('#totalHours')).toHaveText('0.00');
  });
});

test.describe('Settings', () => {
  test('should persist hourly rate', async ({ page }) => {
    await page.fill('#hourlyRate', '75');
    await page.locator('#hourlyRate').blur();
    
    await page.reload();
    
    await expect(page.locator('#hourlyRate')).toHaveValue('75');
  });

  test('should update calculations when rate changes', async ({ page }) => {
    const today = new Date().toISOString().split('T')[0];
    
    // Add 8 hours
    await page.fill('#manualDate', today);
    await page.fill('#manualClockIn', '09:00');
    await page.fill('#manualClockOut', '17:00');
    await page.click('button:has-text("Add Entry")');
    
    // Set rate to $50
    await page.fill('#hourlyRate', '50');
    await page.locator('#hourlyRate').blur();
    
    await expect(page.locator('#grossEarnings')).toHaveText('$400.00');
    
    // Change rate to $100
    await page.fill('#hourlyRate', '100');
    await page.locator('#hourlyRate').blur();
    
    await expect(page.locator('#grossEarnings')).toHaveText('$800.00');
  });
});
