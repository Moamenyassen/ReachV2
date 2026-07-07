/**
 * SysAdmin Team Management — only accessible to users with the
 * `manage_sysadmins` permission (owner + any admin granted the override).
 *
 * Lets the owner:
 *   - List all sysadmins with role, permissions, last login
 *   - Invite a new sysadmin (must already exist as a Supabase Auth user)
 *   - Change role / per-permission overrides / activate / deactivate
 *   - Delete a sysadmin (owner-protected by DB trigger)
 *   - Transfer ownership (owner-only; demotes current owner to admin)
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
    AlertTriangle, Check, Crown, Mail, Plus, Shield, ShieldCheck, Trash2, UserCog, X,
} from 'lucide-react';
import {
    ALL_PERMISSIONS, Permission, Permissions, SysAdminRole, TeamMember, sysadminApi,
} from '../../../services/sysadminApi';
import {
    BTN, ConfirmModal, EmptyState, INPUT_CLS, InlineBanner, PageHeader, StatusBadge,
    SysCard, SysModal, ModalFooter, SELECT_CLS, TABLE_CLS,
} from './SysAdminShared';

const ROLES: { value: SysAdminRole; label: string; description: string }[] = [
    { value: 'owner',    label: 'Owner',    description: 'Full control — singleton; transfer required to demote.' },
    { value: 'admin',    label: 'Admin',    description: 'All operational access; cannot manage sysadmins.' },
    { value: 'support',  label: 'Support',  description: 'Read-only + resolve errors.' },
    { value: 'billing',  label: 'Billing',  description: 'Plans, promos, affiliates, licenses.' },
    { value: 'security', label: 'Security', description: 'Audit, sessions, force-logout, errors.' },
];

const PERM_LABEL: Record<Permission, string> = {
    manage_sysadmins: 'Manage Sysadmins',
    manage_companies: 'Manage Companies',
    manage_licenses:  'Manage Licenses',
    manage_plans:     'Manage Plans',
    manage_promos:    'Manage Promos',
    manage_affiliates:'Manage Affiliates',
    force_logout:     'Force Logout',
    resolve_errors:   'Resolve Errors',
    set_feature_flags:'Feature Flags',
    view_audit_log:   'View Audit Log',
    view_usage:       'View Usage / Cost',
};

const fmtDate = (iso?: string | null) => iso ? new Date(iso).toLocaleString() : '—';

interface Props {
    currentRole: SysAdminRole;
    currentSysadminId?: string;
}

const SysAdminTeam: React.FC<Props> = ({ currentRole, currentSysadminId }) => {
    const [members, setMembers] = useState<TeamMember[]>([]);
    const [defaults, setDefaults] = useState<Record<SysAdminRole, Permissions>>({} as any);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);
    const [info, setInfo] = useState<string | null>(null);

    const [showInvite, setShowInvite] = useState(false);
    const [editing, setEditing] = useState<TeamMember | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<TeamMember | null>(null);

    const refresh = async () => {
        setLoading(true);
        setErr(null);
        try {
            const r = await sysadminApi.teamList();
            setMembers(r.rows);
            setDefaults(r.role_defaults);
        } catch (e: any) {
            setErr(e?.message || 'Failed to load team');
        } finally {
            setLoading(false);
        }
    };
    useEffect(() => { refresh(); }, []);

    return (
        <div className="space-y-6">
            <PageHeader
                icon={<UserCog className="w-5 h-5 text-indigo-400" />}
                title="System Users"
                subtitle="Manage who has access to the System Core and what they can do"
                actions={
                    <button onClick={() => setShowInvite(true)} className={BTN.primary}>
                        <Plus className="w-4 h-4" /> Add system user
                    </button>
                }
            />

            {err && <InlineBanner type="error" message={err} onDismiss={() => setErr(null)} />}
            {info && <InlineBanner type="success" message={info} onDismiss={() => setInfo(null)} />}

            <SysCard>
                {loading && <div className="p-6 text-slate-500 text-sm">Loading…</div>}
                {!loading && members.length === 0 && (
                    <EmptyState
                        icon={<UserCog />}
                        title="No system users yet"
                        description="Seed the first owner via the migration_system_users.sql INSERT, then come back here to add teammates."
                    />
                )}
                {members.length > 0 && (
                    <div className={TABLE_CLS.wrapper}>
                        <div className={TABLE_CLS.header} style={{ gridTemplateColumns: '2fr 2fr 1fr 1fr 1.4fr 1fr' }}>
                            <div>Member</div><div>Email</div><div>Role</div><div>MFA</div><div>Last login</div><div className="text-right">Actions</div>
                        </div>
                        {members.map(m => (
                            <div key={m.id} className={TABLE_CLS.row} style={{ gridTemplateColumns: '2fr 2fr 1fr 1fr 1.4fr 1fr' }}>
                                <div className="flex items-center gap-2 min-w-0">
                                    {m.role === 'owner' && <Crown className="w-4 h-4 text-amber-400 shrink-0" />}
                                    <div className="min-w-0">
                                        <div className="text-sm text-white font-bold truncate">{m.display_name}</div>
                                        {!m.is_active && <span className="text-[10px] uppercase tracking-wider text-red-400 font-bold">Disabled</span>}
                                        {m.id === currentSysadminId && <span className="text-[10px] uppercase tracking-wider text-indigo-400 font-bold">You</span>}
                                    </div>
                                </div>
                                <div className="text-sm text-slate-400 truncate">{m.email}</div>
                                <div><RolePill role={m.role} /></div>
                                <div>
                                    <StatusBadge status={m.mfa_required ? 'active' : 'pending'} label={m.mfa_required ? 'Required' : 'Optional'} />
                                </div>
                                <div className="text-xs text-slate-400">{fmtDate(m.last_login_at)}</div>
                                <div className="flex justify-end gap-2">
                                    <button onClick={() => setEditing(m)} className={`${BTN.secondary} text-xs`}>Edit</button>
                                    {m.role !== 'owner' && m.id !== currentSysadminId && (
                                        <button onClick={() => setConfirmDelete(m)} className={`${BTN.danger} text-xs`}>
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </SysCard>

            {showInvite && (
                <InviteModal
                    onClose={() => setShowInvite(false)}
                    onDone={(msg) => { setShowInvite(false); setInfo(msg); refresh(); }}
                    onError={setErr}
                    defaults={defaults}
                />
            )}

            {editing && (
                <EditModal
                    member={editing}
                    currentRole={currentRole}
                    defaults={defaults}
                    onClose={() => setEditing(null)}
                    onDone={(msg) => { setEditing(null); setInfo(msg); refresh(); }}
                    onError={setErr}
                />
            )}

            <ConfirmModal
                isOpen={!!confirmDelete}
                onClose={() => setConfirmDelete(null)}
                onConfirm={async () => {
                    if (!confirmDelete) return;
                    try {
                        await sysadminApi.teamDelete(confirmDelete.id);
                        setInfo(`Removed ${confirmDelete.display_name}.`);
                        setConfirmDelete(null);
                        refresh();
                    } catch (e: any) {
                        setErr(e?.message || 'Delete failed');
                        setConfirmDelete(null);
                    }
                }}
                title="Remove sysadmin"
                description={`Permanently remove ${confirmDelete?.display_name} (${confirmDelete?.email}) from the sysadmin team. Their Supabase Auth account remains; only the sysadmin role is revoked.`}
                target={confirmDelete?.email}
            />
        </div>
    );
};

// ──────────────────────────────────────────────────────────────────────────────
const RolePill: React.FC<{ role: SysAdminRole }> = ({ role }) => {
    const styles: Record<SysAdminRole, string> = {
        owner:    'bg-amber-500/15 text-amber-300 border-amber-500/30',
        admin:    'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
        support:  'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
        billing:  'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
        security: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    };
    return (
        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${styles[role]}`}>
            {role === 'owner' && <Crown className="w-3 h-3" />}
            {role}
        </span>
    );
};

// ──────────────────────────────────────────────────────────────────────────────
const InviteModal: React.FC<{
    onClose: () => void;
    onDone: (msg: string) => void;
    onError: (msg: string) => void;
    defaults: Record<SysAdminRole, Permissions>;
}> = ({ onClose, onDone, onError, defaults }) => {
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState<SysAdminRole>('admin');
    const [overrides, setOverrides] = useState<Permissions>({});
    const [busy, setBusy] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);

    const effective = useMemo(() => ({ ...(defaults[role] || {}), ...overrides }), [defaults, role, overrides]);

    const submit = async () => {
        setBusy(true);
        try {
            await sysadminApi.teamInvite(email.trim(), name.trim(), role, password.trim() || undefined, Object.keys(overrides).length ? overrides : undefined);
            onDone(`Created system user ${name || email}.`);
        } catch (e: any) {
            onError(e?.message || 'Creation failed');
        } finally {
            setBusy(false);
        }
    };

    return (
        <SysModal title="Add a System User" subtitle="Create a new administrator or support user immediately." onClose={onClose}>
            <div className="space-y-4 p-5">
                <div>
                    <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1 block">Email</label>
                    <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                            type="email" value={email} onChange={e => setEmail(e.target.value)}
                            className={`${INPUT_CLS} pl-9`} placeholder="teammate@reach.ai" required
                        />
                    </div>
                </div>
                <div>
                    <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1 block">Display name</label>
                    <input value={name} onChange={e => setName(e.target.value)} className={INPUT_CLS} placeholder="Full name" required />
                </div>
                <div>
                    <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1 block">Password</label>
                    <input
                        type="password" value={password} onChange={e => setPassword(e.target.value)}
                        className={INPUT_CLS} placeholder="Enter login password" required
                    />
                </div>
                <div>
                    <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1 block">Role</label>
                    <select value={role} onChange={e => { setRole(e.target.value as SysAdminRole); setOverrides({}); }} className={SELECT_CLS}>
                        {ROLES.filter(r => r.value !== 'owner').map(r => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                    </select>
                    <p className="text-xs text-slate-500 mt-1.5">{ROLES.find(r => r.value === role)?.description}</p>
                </div>
                <button onClick={() => setShowAdvanced(!showAdvanced)} className="text-xs text-indigo-400 hover:text-indigo-300 font-bold">
                    {showAdvanced ? '−' : '+'} Per-permission overrides
                </button>
                {showAdvanced && (
                    <PermissionGrid effective={effective} overrides={overrides} onChange={setOverrides} />
                )}
            </div>
            <ModalFooter>
                <button onClick={onClose} className={BTN.secondary}>Cancel</button>
                <button onClick={submit} disabled={busy || !email || !name || !password} className={BTN.primary}>
                    {busy ? 'Creating…' : 'Create User'}
                </button>
            </ModalFooter>
        </SysModal>
    );
};

// ──────────────────────────────────────────────────────────────────────────────
const EditModal: React.FC<{
    member: TeamMember;
    currentRole: SysAdminRole;
    defaults: Record<SysAdminRole, Permissions>;
    onClose: () => void;
    onDone: (msg: string) => void;
    onError: (msg: string) => void;
}> = ({ member, currentRole, defaults, onClose, onDone, onError }) => {
    const [role, setRole] = useState<SysAdminRole>(member.role);
    const [name, setName] = useState(member.display_name);
    const [overrides, setOverrides] = useState<Permissions>(member.permissions || {});
    const [active, setActive] = useState(member.is_active);
    const [mfa, setMfa] = useState(member.mfa_required);
    const [busy, setBusy] = useState(false);
    const [confirmTransfer, setConfirmTransfer] = useState(false);

    const effective = useMemo(() => ({ ...(defaults[role] || {}), ...overrides }), [defaults, role, overrides]);

    const isOwnerTarget = member.role === 'owner';
    const promotingToOwner = role === 'owner' && member.role !== 'owner';
    const canTransferOwnership = currentRole === 'owner';

    const submit = async () => {
        if (promotingToOwner && !canTransferOwnership) {
            onError('Only the current owner can transfer ownership.');
            return;
        }
        if (promotingToOwner && !confirmTransfer) {
            setConfirmTransfer(true);
            return;
        }
        setBusy(true);
        try {
            await sysadminApi.teamUpdate(member.id, {
                role,
                display_name: name,
                permissions: overrides,
                is_active: active,
                mfa_required: mfa,
            });
            onDone(`Updated ${name}.`);
        } catch (e: any) {
            onError(e?.message || 'Update failed');
        } finally {
            setBusy(false);
        }
    };

    return (
        <SysModal title={`Edit ${member.display_name}`} subtitle={member.email} onClose={onClose}>
            <div className="space-y-4 p-5 max-h-[70vh] overflow-y-auto">
                <div>
                    <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1 block">Display name</label>
                    <input value={name} onChange={e => setName(e.target.value)} className={INPUT_CLS} />
                </div>
                <div>
                    <label className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1 block">Role</label>
                    <select
                        value={role}
                        onChange={e => { setRole(e.target.value as SysAdminRole); setOverrides({}); }}
                        className={SELECT_CLS}
                        disabled={isOwnerTarget && !canTransferOwnership}
                    >
                        {ROLES.map(r => (
                            <option key={r.value} value={r.value} disabled={r.value === 'owner' && !canTransferOwnership}>
                                {r.label}{r.value === 'owner' ? ' (transfers ownership)' : ''}
                            </option>
                        ))}
                    </select>
                    <p className="text-xs text-slate-500 mt-1.5">{ROLES.find(r => r.value === role)?.description}</p>
                </div>
                {promotingToOwner && (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-xs flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        <div>
                            <b>Transferring ownership.</b> You will be demoted to <code>admin</code>. Only the new owner will be able to manage sysadmins after this.
                        </div>
                    </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                    <label className="flex items-center gap-2 text-sm text-slate-300 font-bold cursor-pointer">
                        <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} disabled={isOwnerTarget} />
                        Active {isOwnerTarget && <span className="text-xs text-slate-500">(owner can't be disabled)</span>}
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-300 font-bold cursor-pointer">
                        <input type="checkbox" checked={mfa} onChange={e => setMfa(e.target.checked)} />
                        MFA required
                    </label>
                </div>
                <div>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2">Per-permission overrides</p>
                    <PermissionGrid effective={effective} overrides={overrides} onChange={setOverrides} />
                </div>
            </div>
            <ModalFooter>
                <button onClick={onClose} className={BTN.secondary}>Cancel</button>
                <button onClick={submit} disabled={busy} className={BTN.primary}>
                    {busy ? 'Saving…' : (promotingToOwner && !confirmTransfer ? 'Confirm transfer' : 'Save changes')}
                </button>
            </ModalFooter>
        </SysModal>
    );
};

// ──────────────────────────────────────────────────────────────────────────────
const PermissionGrid: React.FC<{
    effective: Permissions;
    overrides: Permissions;
    onChange: (p: Permissions) => void;
}> = ({ effective, overrides, onChange }) => {
    const toggle = (p: Permission) => {
        const next = { ...overrides };
        // If currently overridden, remove the override (revert to role default)
        // Otherwise set override opposite of effective
        if (p in overrides) {
            delete next[p];
        } else {
            next[p] = !effective[p];
        }
        onChange(next);
    };

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ALL_PERMISSIONS.map(p => {
                const isOn = effective[p];
                const isOverridden = p in overrides;
                return (
                    <button
                        key={p}
                        onClick={() => toggle(p)}
                        type="button"
                        className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border text-xs font-bold transition-all ${
                            isOn
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                                : 'bg-white/5 border-white/10 text-slate-500'
                        }`}
                    >
                        <span className="flex items-center gap-2 truncate">
                            {isOn ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                            <span className="truncate">{PERM_LABEL[p]}</span>
                        </span>
                        {isOverridden && <span className="text-[9px] uppercase tracking-wider text-amber-400">Override</span>}
                    </button>
                );
            })}
        </div>
    );
};

export default SysAdminTeam;
