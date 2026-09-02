import * as supabase from "https://esm.sh/@supabase/supabase-js@2?bundle";

const OWNER_FUNCTION = "portal-usage-admin";
const TENANT_FUNCTION = "portal-usage-tenant";

function isTenantMonitorRoute() {
  const path = String(window.location?.pathname || "").replace(/\/+$/, "");
  return path.endsWith("/tenant-usage.html");
}

function monitorFunctionName() {
  return isTenantMonitorRoute() ? TENANT_FUNCTION : OWNER_FUNCTION;
}

function syncMonitorNavigation(targetFunction) {
  const current = document.querySelector('.portal-nav a[aria-current="page"]');
  if (!current) return;
  current.setAttribute("href", targetFunction === TENANT_FUNCTION ? "./tenant-usage.html" : "./usage.html");
}

function bindMember(owner, value) {
  return typeof value === "function" ? value.bind(owner) : value;
}

function projectTaskLifecycle(auditValue) {
  if (!auditValue || typeof auditValue !== "object" || Array.isArray(auditValue)) return auditValue;
  const audit = auditValue;
  const storedStatus = String(audit.status || "").trim().toLowerCase();
  const hardTerminal = storedStatus === "failed" || storedStatus === "cancelled";

  // The telemetry row status is phase-local. The monitor presents the whole
  // product lifecycle: prepare READY is not a successful listing; execution
  // still has to run. Likewise, a completed row that still requires review is
  // not presented as an unconditional success.
  let monitorStatus = storedStatus;
  if (!hardTerminal && audit.review_required === true) monitorStatus = "review";
  else if (storedStatus === "ready") monitorStatus = "running";

  if (monitorStatus === storedStatus) return audit;
  return {
    ...audit,
    status: monitorStatus,
    phase_status: storedStatus,
    monitor_status_projected: true
  };
}

function projectMonitorPayload(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return data;
  let changed = false;
  const output = { ...data };

  if (Array.isArray(data.task_audits)) {
    output.task_audits = data.task_audits.map((audit) => {
      const projected = projectTaskLifecycle(audit);
      if (projected !== audit) changed = true;
      return projected;
    });
  }

  if (data.task_audit && typeof data.task_audit === "object" && !Array.isArray(data.task_audit)) {
    const projected = projectTaskLifecycle(data.task_audit);
    if (projected !== data.task_audit) changed = true;
    output.task_audit = projected;
  }

  return changed ? output : data;
}

function routedFunctions(client, targetFunction) {
  const functions = Reflect.get(client, "functions", client);
  return new Proxy(functions, {
    get(target, property, receiver) {
      if (property === "invoke") {
        return async (functionName, options) => {
          const result = await target.invoke(
            functionName === OWNER_FUNCTION ? targetFunction : functionName,
            options
          );
          if (!result || typeof result !== "object") return result;
          return { ...result, data: projectMonitorPayload(result.data) };
        };
      }
      return bindMember(target, Reflect.get(target, property, receiver));
    }
  });
}

export function createClient(...args) {
  const client = supabase.createClient(...args);
  const targetFunction = monitorFunctionName();
  syncMonitorNavigation(targetFunction);

  // Always proxy monitor function responses, including the owner route, so the
  // UI consumes one lifecycle contract independent of which read model serves it.
  return new Proxy(client, {
    get(target, property, receiver) {
      if (property === "functions") return routedFunctions(target, targetFunction);
      return bindMember(target, Reflect.get(target, property, receiver));
    }
  });
}

export * from "https://esm.sh/@supabase/supabase-js@2?bundle";
