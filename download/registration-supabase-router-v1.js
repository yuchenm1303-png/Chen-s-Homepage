import * as supabase from "https://esm.sh/@supabase/supabase-js@2?bundle";

const FIRST_CLIENT_CHANNEL = "first-client";
const DIRECT_CHANNEL = "direct";

function registrationChannel() {
  return window.DOWNLOAD_PORTAL_REGISTRATION_CHANNEL === DIRECT_CHANNEL
    ? DIRECT_CHANNEL
    : FIRST_CLIENT_CHANNEL;
}

function bindMember(owner, value) {
  return typeof value === "function" ? value.bind(owner) : value;
}

function routedAuth(client) {
  const auth = Reflect.get(client, "auth", client);
  return new Proxy(auth, {
    get(target, property, receiver) {
      if (property === "signUp") {
        return (credentials) => {
          const input = credentials && typeof credentials === "object" ? credentials : {};
          const options = input.options && typeof input.options === "object" ? input.options : {};
          const data = options.data && typeof options.data === "object" ? options.data : {};
          return target.signUp({
            ...input,
            options: {
              ...options,
              data: {
                ...data,
                registration_channel: registrationChannel()
              }
            }
          });
        };
      }
      return bindMember(target, Reflect.get(target, property, receiver));
    }
  });
}

export function createClient(...args) {
  const client = supabase.createClient(...args);
  return new Proxy(client, {
    get(target, property, receiver) {
      if (property === "auth") return routedAuth(target);
      return bindMember(target, Reflect.get(target, property, receiver));
    }
  });
}

export * from "https://esm.sh/@supabase/supabase-js@2?bundle";
