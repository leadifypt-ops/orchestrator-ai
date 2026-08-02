import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  RECONCILIATION_PRIORITIES,
  RECONCILIATION_STATUSES,
  RECONCILIATION_TYPES,
  firstSearchValue,
  reconciliationPriorityLabels,
  reconciliationStatusLabels,
  reconciliationTypeLabels,
  type ReconciliationAssignee,
  type ReconciliationPriority,
  type ReconciliationQueueItem,
  type ReconciliationStatus,
} from "@/lib/reconciliation";
import {
  buildReconciliationSlaContexts,
  reconciliationSlaHoursFromPolicy,
  type ReconciliationQueueSlaAuditEvent,
  type ReconciliationSlaPolicyAuditEvent,
  type ReconciliationSlaPolicyRow,
} from "@/lib/reconciliation-sla-policy";
import { CreateReconciliationForm } from "./reconciliation-forms";
import { SlaPolicyGovernance } from "./sla-policy-governance";
import {
  ReconciliationReporting,
  ReconciliationTimingCells,
  reconciliationRowClass,
} from "./reconciliation-reporting";

type QueuePageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type BusinessRow = { id: string; name: string };
type RestaurantRow = { id: string; business_id: string; name: string | null };
type GuestRow = {
  id: string;
  business_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
};

const queueSelect = `
  id, business_id, reconciliation_type, status, priority, restaurant_id,
  guest_identity_id, reservation_id, audit_event_id, merge_audit_event_id,
  recovery_event_id, recovery_execution_event_id, reconciliation_review_id,
  origin, assigned_to, created_by, created_at, updated_at,
  restaurant:restaurants!reconciliation_queue_items_restaurant_id_fkey(id, name),
  guest:guest_identities!reconciliation_queue_items_guest_identity_id_fkey(id, full_name, email, phone),
  reservation:reservations!reconciliation_queue_items_reservation_id_fkey(id, guest_name, requested_date)
`;

function isOneOf<T extends string>(value: string, options: readonly T[]): value is T {
  return options.includes(value as T);
}

function assigneeLabel(item: ReconciliationQueueItem, byId: Map<string, string>) {
  return item.assigned_to ? byId.get(item.assigned_to) || item.assigned_to : "Unassigned";
}

function priorityClass(priority: ReconciliationPriority) {
  if (priority === "high") return "border-red-500/30 bg-red-500/10 text-red-200";
  if (priority === "medium") return "border-amber-500/30 bg-amber-500/10 text-amber-200";
  return "border-sky-500/30 bg-sky-500/10 text-sky-200";
}

function statusClass(status: ReconciliationStatus) {
  if (status === "completed") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  if (status === "in_review") return "border-violet-500/30 bg-violet-500/10 text-violet-200";
  return "border-white/10 bg-white/5 text-zinc-300";
}

export const dynamic = "force-dynamic";

export default async function ReconciliationQueuePage({ params, searchParams }: QueuePageProps) {
  const { locale } = await params;
  const query = await searchParams;
  const supabase = await createClient();

  const [
    queueResult,
    businessResult,
    restaurantResult,
    guestResult,
    queueAuditResult,
    slaPolicyResult,
    slaPolicyAuditResult,
    userResult,
  ] = await Promise.all([
    supabase.from("reconciliation_queue_items").select(queueSelect).limit(500),
    supabase.from("businesses").select("id, name").order("name"),
    supabase.from("restaurants").select("id, business_id, name").order("name"),
    supabase.from("guest_identities").select("id, business_id, full_name, email, phone").order("full_name").limit(500),
    supabase
      .from("reconciliation_queue_audit_events")
      .select("reconciliation_item_id, change_type, new_value, created_at")
      .in("change_type", ["created", "status_changed", "priority_changed"])
      .order("created_at", { ascending: true }),
    supabase
      .from("reconciliation_sla_policies")
      .select("business_id, high_priority_hours, medium_priority_hours, low_priority_hours, created_at, updated_at, updated_by"),
    supabase
      .from("reconciliation_sla_policy_audit_events")
      .select("id, business_id, change_type, previous_values, new_values, changed_by, created_at")
      .order("created_at", { ascending: true }),
    supabase.auth.getUser(),
  ]);

  const businesses = (businessResult.data || []) as BusinessRow[];
  const assigneeResults = await Promise.all(
    businesses.map(async (business) => {
      const { data } = await supabase.rpc("list_reconciliation_assignees_v1", {
        p_business_id: business.id,
      });
      return ((data || []) as ReconciliationAssignee[]).map((member) => ({
        ...member,
        business_id: business.id,
      }));
    })
  );
  const assignees = assigneeResults.flat();
  const assigneesById = new Map(
    assignees.map((member) => [member.user_id, member.email || member.user_id])
  );

  const currentUserId = userResult.data.user?.id || null;
  const activePolicies = (slaPolicyResult.data || []) as ReconciliationSlaPolicyRow[];
  const policyHistory = (slaPolicyAuditResult.data || []) as ReconciliationSlaPolicyAuditEvent[];
  const policiesByBusiness = new Map(
    activePolicies.map((policy) => [policy.business_id, policy])
  );
  const governanceBusinesses = businesses.map((business) => ({
    ...business,
    role: assignees.find(
      (member) => member.business_id === business.id && member.user_id === currentUserId
    )?.role || null,
    policy: policiesByBusiness.get(business.id) || null,
    history: policyHistory
      .filter((event) => event.business_id === business.id)
      .sort((left, right) => right.created_at.localeCompare(left.created_at)),
  }));
  const policySummaries = businesses.map((business) => ({
    businessId: business.id,
    businessName: business.name,
    hours: reconciliationSlaHoursFromPolicy(policiesByBusiness.get(business.id)),
  }));


  const queueHistory = (queueAuditResult.data || []) as ReconciliationQueueSlaAuditEvent[];
  const completionByItem: Record<string, string> = {};
  for (const audit of queueHistory) {
    if (audit.change_type === "status_changed" && audit.new_value.status === "completed") {
      completionByItem[audit.reconciliation_item_id] = audit.created_at;
    }
  }
  const now = new Date();
  let items = (queueResult.data || []) as unknown as ReconciliationQueueItem[];
  const search = firstSearchValue(query.q).trim().toLocaleLowerCase();
  const statusValue = firstSearchValue(query.status);
  const priorityValue = firstSearchValue(query.priority);
  const typeValue = firstSearchValue(query.type);
  const status = isOneOf(statusValue, RECONCILIATION_STATUSES) ? statusValue : "";
  const priority = isOneOf(priorityValue, RECONCILIATION_PRIORITIES) ? priorityValue : "";
  const type = isOneOf(typeValue, RECONCILIATION_TYPES) ? typeValue : "";
  const assigneeValue = firstSearchValue(query.assignee);
  const assignee = assigneeValue === "unassigned" || assigneesById.has(assigneeValue)
    ? assigneeValue
    : "";

  items = items.filter((item) => {
    if (status && item.status !== status) return false;
    if (priority && item.priority !== priority) return false;
    if (type && item.reconciliation_type !== type) return false;
    if (assignee === "unassigned" && item.assigned_to !== null) return false;
    if (assignee && assignee !== "unassigned" && item.assigned_to !== assignee) return false;
    if (!search) return true;
    return [
      item.origin,
      item.restaurant?.name,
      item.guest?.full_name,
      item.guest?.email,
      item.guest?.phone,
      item.reservation?.guest_name,
      assigneeLabel(item, assigneesById),
      reconciliationTypeLabels[item.reconciliation_type],
    ].some((candidate) => candidate?.toLocaleLowerCase().includes(search));
  });

  const sort = firstSearchValue(query.sort) || "updated_desc";
  const direction = sort.endsWith("_asc") ? 1 : -1;
  const sortField = sort.replace(/_(asc|desc)$/, "");
  items.sort((a, b) => {
    const values: Record<string, [string, string]> = {
      created: [a.created_at, b.created_at],
      updated: [a.updated_at, b.updated_at],
      type: [reconciliationTypeLabels[a.reconciliation_type], reconciliationTypeLabels[b.reconciliation_type]],
      status: [reconciliationStatusLabels[a.status], reconciliationStatusLabels[b.status]],
      priority: [reconciliationPriorityLabels[a.priority], reconciliationPriorityLabels[b.priority]],
      restaurant: [a.restaurant?.name || "", b.restaurant?.name || ""],
      guest: [a.guest?.full_name || "", b.guest?.full_name || ""],
      assignee: [assigneeLabel(a, assigneesById), assigneeLabel(b, assigneesById)],
    };
    const [left, right] = values[sortField] || values.updated;
    return left.localeCompare(right, locale) * direction;
  });

  const slaContexts = buildReconciliationSlaContexts(
    items,
    completionByItem,
    activePolicies,
    policyHistory,
    queueHistory
  );
  const loadError = queueResult.error
    || businessResult.error
    || restaurantResult.error
    || guestResult.error
    || queueAuditResult.error
    || slaPolicyResult.error
    || slaPolicyAuditResult.error
    || userResult.error;
  const restaurants = (restaurantResult.data || []) as RestaurantRow[];
  const guests = (guestResult.data || []) as GuestRow[];

  return (
    <div className="space-y-6 p-6 text-white">
      <header className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">Operations</p>
        <h1 className="mt-2 text-3xl font-semibold">Reconciliation queue</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">
          Business-wide operational work only. Queue actions never rewrite Guest Identity or historical records.
        </p>
      </header>

      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <h2 className="text-lg font-semibold">Create reconciliation</h2>
        <p className="mt-1 text-sm text-zinc-500">Manual items begin in Pending. Explicit post-recovery follow-up is routed here automatically.</p>
        <CreateReconciliationForm
          businesses={businesses}
          restaurants={restaurants.map((restaurant) => ({ id: restaurant.id, business_id: restaurant.business_id, label: restaurant.name || "Unnamed restaurant" }))}
          guests={guests.map((guest) => ({ id: guest.id, business_id: guest.business_id, label: guest.full_name || guest.email || guest.phone || guest.id }))}
          assignees={assignees}
        />
      </section>

      <SlaPolicyGovernance businesses={governanceBusinesses} />

      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <form className="grid gap-3 lg:grid-cols-7" action={`/${locale}/business/reconciliation`}>
          <label className="text-xs text-zinc-500 lg:col-span-2">Search
            <input name="q" defaultValue={firstSearchValue(query.q)} placeholder="Guest, restaurant, origin, assignee..." className="mt-1 w-full rounded-lg border border-white/10 bg-black px-3 py-2 text-sm text-white" />
          </label>
          <label className="text-xs text-zinc-500">Status
            <select name="status" defaultValue={status} className="mt-1 w-full rounded-lg border border-white/10 bg-black px-3 py-2 text-sm text-white"><option value="">All</option>{RECONCILIATION_STATUSES.map((value) => <option key={value} value={value}>{reconciliationStatusLabels[value]}</option>)}</select>
          </label>
          <label className="text-xs text-zinc-500">Priority
            <select name="priority" defaultValue={priority} className="mt-1 w-full rounded-lg border border-white/10 bg-black px-3 py-2 text-sm text-white"><option value="">All</option>{RECONCILIATION_PRIORITIES.map((value) => <option key={value} value={value}>{reconciliationPriorityLabels[value]}</option>)}</select>
          </label>
          <label className="text-xs text-zinc-500">Type
            <select name="type" defaultValue={type} className="mt-1 w-full rounded-lg border border-white/10 bg-black px-3 py-2 text-sm text-white"><option value="">All</option>{RECONCILIATION_TYPES.map((value) => <option key={value} value={value}>{reconciliationTypeLabels[value]}</option>)}</select>
          </label>
          <label className="text-xs text-zinc-500">Responsible
            <select name="assignee" defaultValue={assignee} className="mt-1 w-full rounded-lg border border-white/10 bg-black px-3 py-2 text-sm text-white">
              <option value="">All</option><option value="unassigned">Unassigned</option>
              {Array.from(assigneesById.entries()).map(([userId, label]) => <option key={userId} value={userId}>{label}</option>)}
            </select>
          </label>
          <label className="text-xs text-zinc-500">Sort
            <select name="sort" defaultValue={sort} className="mt-1 w-full rounded-lg border border-white/10 bg-black px-3 py-2 text-sm text-white">
              <option value="updated_desc">Updated / newest</option><option value="updated_asc">Updated / oldest</option>
              <option value="created_desc">Created / newest</option><option value="created_asc">Created / oldest</option>
              <option value="priority_asc">Priority / A-Z</option><option value="type_asc">Type / A-Z</option>
              <option value="restaurant_asc">Restaurant / A-Z</option><option value="guest_asc">Guest / A-Z</option><option value="assignee_asc">Assignee / A-Z</option>
            </select>
          </label>
          <div className="flex items-end gap-2 lg:col-span-6">
            <button className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black">Apply</button>
            <Link href={`/${locale}/business/reconciliation`} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-300">Clear</Link>
            <span className="ml-auto text-sm text-zinc-500">{items.length} items</span>
          </div>
        </form>
      </section>

      <ReconciliationReporting
        items={items}
        assignees={assignees}
        completionByItem={completionByItem}
        now={now}
        contexts={slaContexts}
        policySummaries={policySummaries}
      />

      {loadError ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">Could not load the reconciliation queue: {loadError.message}</div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="min-w-[1440px] w-full text-left text-sm">
            <thead className="bg-white/[0.04] text-xs uppercase tracking-wider text-zinc-500"><tr>{["Type", "Status", "Priority", "Responsible", "Age", "Last activity", "SLA", "Restaurant", "Guest", "Origin", ""].map((label, index) => <th key={`${label}-${index}`} className="px-4 py-3 font-medium">{label}</th>)}</tr></thead>
            <tbody className="divide-y divide-white/10">
              {items.map((item) => (
                <tr key={item.id} className={reconciliationRowClass(
                  item,
                  completionByItem[item.id] || null,
                  now,
                  slaContexts[item.id]
                )}>
                  <td className="px-4 py-4 font-medium">{reconciliationTypeLabels[item.reconciliation_type]}</td>
                  <td className="px-4 py-4"><span className={`rounded-full border px-2.5 py-1 text-xs ${statusClass(item.status)}`}>{reconciliationStatusLabels[item.status]}</span></td>
                  <td className="px-4 py-4"><span className={`rounded-full border px-2.5 py-1 text-xs ${priorityClass(item.priority)}`}>{reconciliationPriorityLabels[item.priority]}</span></td>
                  <td className="px-4 py-4 text-zinc-300">{assigneeLabel(item, assigneesById)}</td>
                  <ReconciliationTimingCells
                    item={item}
                    completedAt={completionByItem[item.id] || null}
                    now={now}
                    locale={locale}
                    context={slaContexts[item.id]}
                  />
                  <td className="px-4 py-4 text-zinc-300">{item.restaurant?.name || "-"}</td>
                  <td className="px-4 py-4 text-zinc-300">{item.guest?.full_name || item.reservation?.guest_name || "-"}</td>
                  <td className="max-w-xs truncate px-4 py-4 text-zinc-400" title={item.origin}>{item.origin}</td>
                  <td className="px-4 py-4"><Link href={`/${locale}/business/reconciliation/${item.id}`} className="text-zinc-300 hover:text-white">View</Link></td>
                </tr>
              ))}
              {items.length === 0 ? <tr><td colSpan={11} className="px-4 py-10 text-center text-zinc-500">No reconciliations match these criteria.</td></tr> : null}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
