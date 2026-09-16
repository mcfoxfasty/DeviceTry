'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building,
  Sparkles,
  ExternalLink,
  Save,
  Plus,
  Trash2,
  Printer,
  Download,
  AlertTriangle,
  CheckCircle,
  HardDrive,
  Laptop,
  FileText,
  LogOut,
  ShieldAlert,
} from 'lucide-react';
import { Translations, Locale } from '@/lib/i18n/types';
import { User, Workspace, Device, ChecklistTemplate, InspectionRecord } from '@/lib/db/schema';

interface WorkspaceDashboardProps {
  t: Translations;
  locale: Locale;
  user: User;
  workspace: Workspace;
  isPro: boolean;
  subscriptionStatus: string;
  renewsAt?: number;
  usage: {
    currentMonthCount: number;
    maxMonthlyLimit: number;
    totalRetained: number;
    maxRetainedLimit: number;
    devicesCount: number;
    maxDevicesLimit: number;
    templatesCount: number;
    maxTemplatesLimit: number;
  };
  initialInspections: InspectionRecord[];
  initialDevices: Device[];
  initialTemplates: ChecklistTemplate[];
}

export function WorkspaceDashboard({
  t,
  locale,
  user,
  workspace,
  isPro,
  subscriptionStatus,
  renewsAt,
  usage: initialUsage,
  initialInspections,
  initialDevices,
  initialTemplates,
}: WorkspaceDashboardProps) {
  const router = useRouter();

  // Active tab inside workspace
  const [activeTab, setActiveTab] = useState<'inspections' | 'devices' | 'templates' | 'branding' | 'settings'>(
    'inspections'
  );

  // Data states
  const [inspections, setInspections] = useState<InspectionRecord[]>(initialInspections);
  const [devices, setDevices] = useState<Device[]>(initialDevices);
  const [templates, setTemplates] = useState<ChecklistTemplate[]>(initialTemplates);
  const [usage, setUsage] = useState(initialUsage);

  // Branding state
  const [companyName, setCompanyName] = useState<string>(workspace.branding_company_name || '');
  const [logoUrl, setLogoUrl] = useState<string>(workspace.branding_logo_url || '');
  const [brandingSaved, setBrandingSaved] = useState<boolean>(false);
  const [savingBranding, setSavingBranding] = useState<boolean>(false);

  // New Device Form state
  const [newDeviceName, setNewDeviceName] = useState<string>('');
  const [newDeviceModel, setNewDeviceModel] = useState<string>('');
  const [newDeviceSerial, setNewDeviceSerial] = useState<string>('');
  const [newDeviceCategory, setNewDeviceCategory] = useState<'laptop' | 'desktop' | 'peripherals' | 'display' | 'other'>('laptop');
  const [newDeviceAssignee, setNewDeviceAssignee] = useState<string>('');

  // New Template Form state
  const [newTemplateTitle, setNewTemplateTitle] = useState<string>('');
  const [newTemplateDesc, setNewTemplateDesc] = useState<string>('');
  const [newTemplateTests, setNewTemplateTests] = useState<string[]>(['mic', 'webcam', 'keyboard']);

  // Account deletion state
  const [deleteEmailInput, setDeleteEmailInput] = useState<string>('');
  const [deletingAccount, setDeletingAccount] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Stripe portal loading
  const [portalLoading, setPortalLoading] = useState<boolean>(false);

  const handleOpenPortal = async () => {
    setPortalLoading(true);
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || 'Failed to open billing portal');
        setPortalLoading(false);
      }
    } catch {
      alert('Network error');
      setPortalLoading(false);
    }
  };

  const handleSaveBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBranding(true);
    try {
      const res = await fetch('/api/workspace/branding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName, logoUrl }),
      });
      if (res.ok) {
        setBrandingSaved(true);
        setTimeout(() => setBrandingSaved(false), 3000);
      }
    } finally {
      setSavingBranding(false);
    }
  };

  const handleCreateDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeviceName) return;

    const res = await fetch('/api/devices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newDeviceName,
        modelIdentifier: newDeviceModel,
        serialNumber: newDeviceSerial,
        category: newDeviceCategory,
        assignedTo: newDeviceAssignee,
      }),
    });

    const data = await res.json();
    if (res.ok) {
      setDevices([data, ...devices]);
      setNewDeviceName('');
      setNewDeviceModel('');
      setNewDeviceSerial('');
      setNewDeviceAssignee('');
    } else {
      alert(data.error || 'Failed to add device');
    }
  };

  const handleDeleteDevice = async (id: string) => {
    if (!confirm('Remove this device from inventory?')) return;
    const res = await fetch(`/api/devices?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      setDevices(devices.filter((d) => d.id !== id));
    }
  };

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTemplateTitle) return;

    const res = await fetch('/api/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: newTemplateTitle,
        description: newTemplateDesc,
        testsConfig: newTemplateTests,
      }),
    });

    const data = await res.json();
    if (res.ok) {
      setTemplates([data, ...templates]);
      setNewTemplateTitle('');
      setNewTemplateDesc('');
    } else {
      alert(data.error || 'Failed to add template');
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Delete this template?')) return;
    const res = await fetch(`/api/templates?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      setTemplates(templates.filter((t) => t.id !== id));
    }
  };

  const handleDeleteInspection = async (id: string) => {
    if (!confirm('Permanently delete this cloud inspection record?')) return;
    const res = await fetch(`/api/inspections?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      setInspections(inspections.filter((i) => i.id !== id));
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push(`/?lang=${locale}`);
    router.refresh();
  };

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    setDeleteError(null);
    try {
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmEmail: deleteEmailInput }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDeleteError(data.error || 'Failed to delete account');
        setDeletingAccount(false);
      } else {
        alert('Account and all associated records have been permanently deleted.');
        router.push(`/?lang=${locale}`);
        router.refresh();
      }
    } catch {
      setDeleteError('Network error');
      setDeletingAccount(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Workspace Header */}
      <div className="bg-white dark:bg-[#131B27] rounded-2xl border border-[#DFE5EB] dark:border-[#223043] p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-[#142033] dark:text-[#E9EEF4]">
              {workspace.branding_company_name || workspace.name}
            </h1>
            {isPro ? (
              <span className="bg-[#0F766E] text-white text-[11px] font-bold px-2 py-0.5 rounded-full uppercase">
                Pro Active
              </span>
            ) : (
              <span className="bg-slate-200 dark:bg-slate-700 text-[#142033] dark:text-[#E9EEF4] text-[11px] font-semibold px-2 py-0.5 rounded-full">
                Free Tier
              </span>
            )}
          </div>
          <p className="text-xs text-[#5F6B7A] dark:text-[#9AA6B8] mt-1">
            Owner: {user.email} • ID: <span className="font-mono">{workspace.id}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isPro ? (
            <button
              onClick={handleOpenPortal}
              disabled={portalLoading}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#F6F7F9] dark:bg-[#192332] text-[#142033] dark:text-[#E9EEF4] border border-[#DFE5EB] dark:border-[#223043] hover:border-[#0F766E] rounded-lg text-xs font-medium transition-colors cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5 text-[#0F766E]" />
              {portalLoading ? 'Loading...' : t.proDashboard.manageBilling}
            </button>
          ) : (
            <button
              onClick={() => router.push(`/pro/subscribe?lang=${locale}`)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0F766E] hover:bg-[#0D665F] text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Subscribe to Pro
            </button>
          )}

          <button
            onClick={handleLogout}
            className="p-2 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
            title={t.nav.signOut}
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Usage Quota Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
        <div className="bg-white dark:bg-[#131B27] p-4 rounded-xl border border-[#DFE5EB] dark:border-[#223043]">
          <p className="text-[#5F6B7A] dark:text-[#9AA6B8]">{t.proDashboard.quotaInspections}</p>
          <p className="text-xl font-bold font-mono-num text-[#142033] dark:text-[#E9EEF4] mt-1">
            {usage.currentMonthCount} / {usage.maxMonthlyLimit}
          </p>
          <p className="text-[10px] text-[#8996A6] mt-0.5">Resets monthly</p>
        </div>

        <div className="bg-white dark:bg-[#131B27] p-4 rounded-xl border border-[#DFE5EB] dark:border-[#223043]">
          <p className="text-[#5F6B7A] dark:text-[#9AA6B8]">{t.proDashboard.quotaRetention}</p>
          <p className="text-xl font-bold font-mono-num text-[#142033] dark:text-[#E9EEF4] mt-1">
            {inspections.length} / {usage.maxRetainedLimit}
          </p>
          <p className="text-[10px] text-[#8996A6] mt-0.5">Cloud history</p>
        </div>

        <div className="bg-white dark:bg-[#131B27] p-4 rounded-xl border border-[#DFE5EB] dark:border-[#223043]">
          <p className="text-[#5F6B7A] dark:text-[#9AA6B8]">{t.proDashboard.quotaInventory}</p>
          <p className="text-xl font-bold font-mono-num text-[#142033] dark:text-[#E9EEF4] mt-1">
            {devices.length} / {usage.maxDevicesLimit}
          </p>
          <p className="text-[10px] text-[#8996A6] mt-0.5">Hardware inventory</p>
        </div>

        <div className="bg-white dark:bg-[#131B27] p-4 rounded-xl border border-[#DFE5EB] dark:border-[#223043]">
          <p className="text-[#5F6B7A] dark:text-[#9AA6B8]">{t.proDashboard.quotaTemplates}</p>
          <p className="text-xl font-bold font-mono-num text-[#142033] dark:text-[#E9EEF4] mt-1">
            {templates.length} / {usage.maxTemplatesLimit}
          </p>
          <p className="text-[10px] text-[#8996A6] mt-0.5">Custom checklists</p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-[#DFE5EB] dark:border-[#223043] gap-6 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('inspections')}
          className={`pb-3 border-b-2 cursor-pointer transition-colors ${
            activeTab === 'inspections'
              ? 'border-[#0F766E] text-[#0F766E] dark:text-[#14B8A6]'
              : 'border-transparent text-[#5F6B7A] dark:text-[#9AA6B8] hover:text-[#142033]'
          }`}
        >
          {t.proDashboard.recentInspections} ({inspections.length})
        </button>

        <button
          onClick={() => setActiveTab('devices')}
          className={`pb-3 border-b-2 cursor-pointer transition-colors ${
            activeTab === 'devices'
              ? 'border-[#0F766E] text-[#0F766E] dark:text-[#14B8A6]'
              : 'border-transparent text-[#5F6B7A] dark:text-[#9AA6B8] hover:text-[#142033]'
          }`}
        >
          {t.proDashboard.deviceInventory} ({devices.length})
        </button>

        <button
          onClick={() => setActiveTab('templates')}
          className={`pb-3 border-b-2 cursor-pointer transition-colors ${
            activeTab === 'templates'
              ? 'border-[#0F766E] text-[#0F766E] dark:text-[#14B8A6]'
              : 'border-transparent text-[#5F6B7A] dark:text-[#9AA6B8] hover:text-[#142033]'
          }`}
        >
          {t.proDashboard.templates} ({templates.length})
        </button>

        <button
          onClick={() => setActiveTab('branding')}
          className={`pb-3 border-b-2 cursor-pointer transition-colors ${
            activeTab === 'branding'
              ? 'border-[#0F766E] text-[#0F766E] dark:text-[#14B8A6]'
              : 'border-transparent text-[#5F6B7A] dark:text-[#9AA6B8] hover:text-[#142033]'
          }`}
        >
          Branding Settings
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`pb-3 border-b-2 cursor-pointer transition-colors ${
            activeTab === 'settings'
              ? 'border-[#0F766E] text-[#0F766E] dark:text-[#14B8A6]'
              : 'border-transparent text-[#5F6B7A] dark:text-[#9AA6B8] hover:text-[#142033]'
          }`}
        >
          {t.proDashboard.accountSettings}
        </button>
      </div>

      {/* TAB 1: Saved Inspections */}
      {activeTab === 'inspections' && (
        <div className="bg-white dark:bg-[#131B27] rounded-xl border border-[#DFE5EB] dark:border-[#223043] p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-4 border-b border-[#DFE5EB] dark:border-[#223043]">
            <h2 className="text-base font-semibold text-[#142033] dark:text-[#E9EEF4]">
              {t.proDashboard.recentInspections}
            </h2>
            <button
              onClick={() => router.push(`/?tab=inspection&lang=${locale}`)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0F766E] hover:bg-[#0D665F] text-white text-xs font-medium rounded-md transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              New Guided Run
            </button>
          </div>

          {inspections.length > 0 ? (
            <div className="space-y-3">
              {inspections.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-xl border border-[#DFE5EB] dark:border-[#223043] bg-[#F6F7F9] dark:bg-[#192332] flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-[#142033] dark:text-[#E9EEF4]">
                        {item.device_label}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          item.summary_status === 'passed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : item.summary_status === 'warning'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {item.summary_status}
                      </span>
                    </div>
                    <p className="text-[#5F6B7A] dark:text-[#9AA6B8] mt-1">
                      {new Date(item.created_at).toLocaleString(locale)} • Inspector: {item.operator_name || 'Owner'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => window.print()}
                      className="px-3 py-1.5 bg-white dark:bg-[#131B27] text-[#142033] dark:text-[#E9EEF4] border border-[#DFE5EB] dark:border-[#223043] rounded-md text-xs font-medium hover:border-[#0F766E] transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Print / PDF
                    </button>

                    <button
                      onClick={() => handleDeleteInspection(item.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                      title="Delete Inspection"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-[#5F6B7A] dark:text-[#9AA6B8]">
              <FileText className="w-8 h-8 mx-auto opacity-40 mb-2" />
              <p className="text-sm font-medium">No cloud inspections saved yet.</p>
              <p className="text-xs mt-1">Run a guided inspection from the homepage and click &quot;Save to Cloud&quot;.</p>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Device Inventory */}
      {activeTab === 'devices' && (
        <div className="bg-white dark:bg-[#131B27] rounded-xl border border-[#DFE5EB] dark:border-[#223043] p-6 shadow-sm space-y-6">
          <div>
            <h2 className="text-base font-semibold text-[#142033] dark:text-[#E9EEF4]">
              {t.proDashboard.deviceInventory}
            </h2>
            <p className="text-xs text-[#5F6B7A] dark:text-[#9AA6B8] mt-0.5">
              Keep track of up to 200 hardware units across your team or repair facility.
            </p>
          </div>

          {/* Add Device Form */}
          <form onSubmit={handleCreateDevice} className="p-4 bg-[#F6F7F9] dark:bg-[#192332] rounded-xl border border-[#DFE5EB] dark:border-[#223043] grid grid-cols-1 sm:grid-cols-5 gap-3">
            <div className="sm:col-span-2">
              <input
                type="text"
                required
                value={newDeviceName}
                onChange={(e) => setNewDeviceName(e.target.value)}
                placeholder="Device Name (e.g. MacBook Pro M3 Max)"
                className="w-full text-xs bg-white dark:bg-[#131B27] border border-[#DFE5EB] dark:border-[#223043] rounded-md px-3 py-2 text-[#142033] dark:text-[#E9EEF4]"
              />
            </div>

            <div>
              <input
                type="text"
                value={newDeviceSerial}
                onChange={(e) => setNewDeviceSerial(e.target.value)}
                placeholder="Serial Number"
                className="w-full text-xs bg-white dark:bg-[#131B27] border border-[#DFE5EB] dark:border-[#223043] rounded-md px-3 py-2 text-[#142033] dark:text-[#E9EEF4]"
              />
            </div>

            <div>
              <select
                value={newDeviceCategory}
                onChange={(e) => setNewDeviceCategory(e.target.value as unknown as 'laptop' | 'desktop' | 'peripherals' | 'display' | 'other')}
                className="w-full text-xs bg-white dark:bg-[#131B27] border border-[#DFE5EB] dark:border-[#223043] rounded-md px-3 py-2 text-[#142033] dark:text-[#E9EEF4]"
              >
                <option value="laptop">Laptop</option>
                <option value="desktop">Desktop</option>
                <option value="peripherals">Peripherals</option>
                <option value="display">Display</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <button
                type="submit"
                className="w-full py-2 bg-[#0F766E] hover:bg-[#0D665F] text-white font-medium text-xs rounded-md transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Device
              </button>
            </div>
          </form>

          {/* Device Inventory List */}
          {devices.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#DFE5EB] dark:border-[#223043] text-[#5F6B7A] dark:text-[#9AA6B8]">
                    <th className="py-2.5 font-semibold">Device</th>
                    <th className="py-2.5 font-semibold">Category</th>
                    <th className="py-2.5 font-semibold">Serial</th>
                    <th className="py-2.5 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#DFE5EB] dark:divide-[#223043]">
                  {devices.map((d) => (
                    <tr key={d.id} className="text-[#142033] dark:text-[#E9EEF4]">
                      <td className="py-3 font-medium">{d.name}</td>
                      <td className="py-3 capitalize text-[#5F6B7A] dark:text-[#9AA6B8]">{d.category}</td>
                      <td className="py-3 font-mono text-[11px] text-[#5F6B7A] dark:text-[#9AA6B8]">{d.serial_number || '—'}</td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => handleDeleteDevice(d.id)}
                          className="p-1 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-8 text-center text-[#5F6B7A] dark:text-[#9AA6B8] text-xs">
              No devices registered in your inventory yet.
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Checklist Templates */}
      {activeTab === 'templates' && (
        <div className="bg-white dark:bg-[#131B27] rounded-xl border border-[#DFE5EB] dark:border-[#223043] p-6 shadow-sm space-y-6">
          <div>
            <h2 className="text-base font-semibold text-[#142033] dark:text-[#E9EEF4]">
              {t.proDashboard.templates}
            </h2>
            <p className="text-xs text-[#5F6B7A] dark:text-[#9AA6B8] mt-0.5">
              Customize multi-step inspection workflows for testing standardized workstation setups.
            </p>
          </div>

          {/* Add Template Form */}
          <form onSubmit={handleCreateTemplate} className="p-4 bg-[#F6F7F9] dark:bg-[#192332] rounded-xl border border-[#DFE5EB] dark:border-[#223043] space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                required
                value={newTemplateTitle}
                onChange={(e) => setNewTemplateTitle(e.target.value)}
                placeholder="Template Name (e.g. Sales Laptop QA)"
                className="text-xs bg-white dark:bg-[#131B27] border border-[#DFE5EB] dark:border-[#223043] rounded-md px-3 py-2 text-[#142033] dark:text-[#E9EEF4]"
              />

              <input
                type="text"
                value={newTemplateDesc}
                onChange={(e) => setNewTemplateDesc(e.target.value)}
                placeholder="Description / Purpose"
                className="text-xs bg-white dark:bg-[#131B27] border border-[#DFE5EB] dark:border-[#223043] rounded-md px-3 py-2 text-[#142033] dark:text-[#E9EEF4]"
              />
            </div>

            <div>
              <p className="text-xs font-semibold text-[#5F6B7A] dark:text-[#9AA6B8] mb-1.5">
                Select Tests to Include:
              </p>
              <div className="flex flex-wrap gap-2 text-xs">
                {['mic', 'webcam', 'keyboard', 'mouse', 'speakers', 'display', 'gamepad', 'battery'].map((tKey) => {
                  const isChecked = newTemplateTests.includes(tKey);
                  return (
                    <button
                      type="button"
                      key={tKey}
                      onClick={() => {
                        if (isChecked) {
                          setNewTemplateTests(newTemplateTests.filter((k) => k !== tKey));
                        } else {
                          setNewTemplateTests([...newTemplateTests, tKey]);
                        }
                      }}
                      className={`px-2.5 py-1 rounded border capitalize cursor-pointer transition-colors ${
                        isChecked
                          ? 'bg-[#0F766E] text-white border-[#0D665F]'
                          : 'bg-white dark:bg-[#131B27] text-[#142033] dark:text-[#E9EEF4] border-[#DFE5EB] dark:border-[#223043]'
                      }`}
                    >
                      {tKey}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              className="py-2 px-4 bg-[#0F766E] hover:bg-[#0D665F] text-white font-medium text-xs rounded-md transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Save Template
            </button>
          </form>

          {/* Template List */}
          <div className="space-y-3">
            {templates.map((tpl) => (
              <div
                key={tpl.id}
                className="p-4 rounded-xl border border-[#DFE5EB] dark:border-[#223043] bg-[#F6F7F9] dark:bg-[#192332] flex items-center justify-between gap-4 text-xs"
              >
                <div>
                  <h3 className="font-semibold text-sm text-[#142033] dark:text-[#E9EEF4]">{tpl.title}</h3>
                  <p className="text-[#5F6B7A] dark:text-[#9AA6B8] mt-0.5">{tpl.description}</p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {tpl.tests_config.map((k) => (
                      <span key={k} className="px-2 py-0.5 bg-white dark:bg-[#131B27] border border-[#DFE5EB] dark:border-[#223043] rounded text-[10px] capitalize">
                        {k}
                      </span>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => handleDeleteTemplate(tpl.id)}
                  className="p-1 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: Custom Branding Settings */}
      {activeTab === 'branding' && (
        <div className="bg-white dark:bg-[#131B27] rounded-xl border border-[#DFE5EB] dark:border-[#223043] p-6 shadow-sm space-y-6 max-w-xl">
          <div>
            <h2 className="text-base font-semibold text-[#142033] dark:text-[#E9EEF4]">
              Branding & Certificate Settings
            </h2>
            <p className="text-xs text-[#5F6B7A] dark:text-[#9AA6B8] mt-0.5">
              Customize the certificate header printed or exported for your clients.
            </p>
          </div>

          <form onSubmit={handleSaveBranding} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-[#5F6B7A] dark:text-[#9AA6B8] mb-1">
                Company / Organization Name
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Apex Hardware Diagnostics Ltd"
                className="w-full bg-[#F6F7F9] dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043] rounded-md px-3 py-2 text-[#142033] dark:text-[#E9EEF4] text-xs"
              />
            </div>

            <div>
              <label className="block font-semibold text-[#5F6B7A] dark:text-[#9AA6B8] mb-1">
                Logo URL (Optional)
              </label>
              <input
                type="url"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://yourcompany.com/logo.png"
                className="w-full bg-[#F6F7F9] dark:bg-[#192332] border border-[#DFE5EB] dark:border-[#223043] rounded-md px-3 py-2 text-[#142033] dark:text-[#E9EEF4] text-xs"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={savingBranding}
                className="py-2 px-4 bg-[#0F766E] hover:bg-[#0D665F] text-white font-medium rounded-md transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                {savingBranding ? 'Saving...' : 'Save Branding'}
              </button>

              {brandingSaved && (
                <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" />
                  Saved
                </span>
              )}
            </div>
          </form>
        </div>
      )}

      {/* TAB 5: Export & Danger Zone */}
      {activeTab === 'settings' && (
        <div className="space-y-6 max-w-xl">
          {/* Export Card */}
          <div className="bg-white dark:bg-[#131B27] rounded-xl border border-[#DFE5EB] dark:border-[#223043] p-6 shadow-sm space-y-3">
            <h2 className="text-base font-semibold text-[#142033] dark:text-[#E9EEF4]">
              Export Workspace Data
            </h2>
            <p className="text-xs text-[#5F6B7A] dark:text-[#9AA6B8] leading-relaxed">
              Download all saved inspections, device inventories, and custom templates as a clean JSON file.
            </p>
            <a
              href="/api/account/export"
              download
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#F6F7F9] dark:bg-[#192332] text-[#142033] dark:text-[#E9EEF4] border border-[#DFE5EB] dark:border-[#223043] hover:border-[#0F766E] rounded-md text-xs font-medium transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Download Complete JSON Export
            </a>
          </div>

          {/* Danger Zone: Right to be Forgotten */}
          <div className="bg-red-50/50 dark:bg-red-950/20 rounded-xl border border-red-200 dark:border-red-900 p-6 space-y-3">
            <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-semibold text-sm">
              <ShieldAlert className="w-4 h-4" />
              Delete Account & Workspace (Right to be Forgotten)
            </div>
            <p className="text-xs text-[#5F6B7A] dark:text-[#9AA6B8] leading-relaxed">
              Permanently cascades and deletes your subscriber profile, workspace, saved inspection records, device inventory, and active session tokens. This action is irreversible.
            </p>

            {deleteError && (
              <div className="p-2.5 bg-red-100 text-red-900 text-xs rounded">
                {deleteError}
              </div>
            )}

            <div className="pt-2">
              <label className="block text-xs font-medium text-[#5F6B7A] dark:text-[#9AA6B8] mb-1">
                Type your email to confirm: <span className="font-mono text-[#142033] dark:text-[#E9EEF4] font-bold">{user.email}</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={deleteEmailInput}
                  onChange={(e) => setDeleteEmailInput(e.target.value)}
                  placeholder={user.email}
                  className="text-xs bg-white dark:bg-[#131B27] border border-red-300 dark:border-red-800 rounded-md px-3 py-2 flex-1 text-[#142033] dark:text-[#E9EEF4]"
                />
                <button
                  onClick={handleDeleteAccount}
                  disabled={deletingAccount || deleteEmailInput.toLowerCase() !== user.email.toLowerCase()}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold text-xs rounded-md transition-colors cursor-pointer disabled:opacity-40"
                >
                  {deletingAccount ? 'Deleting...' : 'Delete Permanently'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
