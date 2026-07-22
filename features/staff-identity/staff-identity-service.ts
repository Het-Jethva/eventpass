export type StaffSession = {
  session: {
    id: string;
  };
  user: {
    email: string;
    id: string;
    name: string;
    suspended: boolean;
  };
};

type MagicLinkRequest = {
  callbackURL: string;
  email: string;
  errorCallbackURL: string;
};

type StaffIdentityGateway = {
  getSession: () => Promise<StaffSession | null>;
  requestMagicLink: (request: MagicLinkRequest) => Promise<void>;
  revokeCurrentSession: () => Promise<void>;
};

export function createStaffIdentityService(gateway: StaffIdentityGateway) {
  return {
    async getActiveSession() {
      const session = await gateway.getSession();

      if (!session || !session.user.suspended) {
        return session;
      }

      await gateway.revokeCurrentSession();
      return null;
    },

    async requestMagicLink(email: string) {
      await gateway.requestMagicLink({
        callbackURL: "/events",
        email: email.trim().toLowerCase(),
        errorCallbackURL: "/sign-in?error=invalid-link",
      });

      return { status: "sent" as const };
    },

    async signOut() {
      await gateway.revokeCurrentSession();
    },
  };
}
