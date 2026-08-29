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

function routedFunctions(client, targetFunction) {
  const functions = Reflect.get(client, "functions", client);
  return new Proxy(functions, {
    get(target, property, receiver) {
      if (property === "invoke") {
        return (functionName, options) => target.invoke(
          functionName === OWNER_FUNCTION ? targetFunction : functionName,
          options
        );
      }
      return bindMember(target, Reflect.get(target, property, receiver));
    }
  });
}

export function createClient(...args) {
  const client = supabase.createClient(...args);
  const targetFunction = monitorFunctionName();
  syncMonitorNavigation(targetFunction);
  if (targetFunction === OWNER_FUNCTION) return client;

  return new Proxy(client, {
    get(target, property, receiver) {
      if (property === "functions") return routedFunctions(target, targetFunction);
      return bindMember(target, Reflect.get(target, property, receiver));
    }
  });
}

export * from "https://esm.sh/@supabase/supabase-js@2?bundle";
