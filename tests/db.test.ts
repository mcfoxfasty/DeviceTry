import test from 'node:test';
import assert from 'node:assert/strict';
import { LocalDatabaseAdapter } from '../lib/db/local-adapter';

test('Database Adapter - Workspace Isolation and Quotas', async () => {
  const db = new LocalDatabaseAdapter();

  // Create Workspace A and Workspace B
  const resA = await db.createUserWithWorkspace({
    email: 'userA@example.com',
    passwordHash: 'hashA',
    name: 'User A',
  });
  const wsA = resA.workspace;

  const resB = await db.createUserWithWorkspace({
    email: 'userB@example.com',
    passwordHash: 'hashB',
    name: 'User B',
  });
  const wsB = resB.workspace;

  // Create Inspection in Workspace A
  const inspA = await db.createInspection(wsA.id, {
    device_id: null,
    device_label: 'Dell XPS 15',
    operator_name: 'Inspector A',
    locale: 'en',
    summary_status: 'passed',
    tests_results: { mic: { status: 'passed' } },
    notes: null,
  });
  assert.strictEqual(inspA.success, true);

  // Verify Workspace B cannot see Workspace A's inspection
  const inspectionsB = await db.getInspections(wsB.id);
  assert.strictEqual(inspectionsB.items.length, 0);

  // Verify Workspace A can see its inspection
  const inspectionsA = await db.getInspections(wsA.id);
  assert.strictEqual(inspectionsA.items.length, 1);
  assert.strictEqual(inspectionsA.items[0].device_label, 'Dell XPS 15');

  // Verify Device Inventory Isolation
  const devA = await db.createDevice(wsA.id, {
    name: 'MacBook Pro M3',
    serial_number: 'SN-A100',
    model_identifier: 'A2992',
    category: 'laptop',
    assigned_to: null,
    notes: null,
  });
  assert.strictEqual(devA.success, true);

  const inventoryB = await db.getDevices(wsB.id);
  assert.strictEqual(inventoryB.length, 0);

  const inventoryA = await db.getDevices(wsA.id);
  assert.strictEqual(inventoryA.length, 1);
  assert.strictEqual(inventoryA[0].name, 'MacBook Pro M3');
});
