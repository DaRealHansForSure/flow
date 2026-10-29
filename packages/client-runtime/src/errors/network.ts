import { BRAND } from "@t3tools/shared/branding";

export const NETWORK_BLOCKING_HINT = `Your DNS or firewall may be blocking ${BRAND.connectName}. Try another network, such as a different Wi-Fi or mobile data.`;

/** For a host that stopped answering on an open connection, so the network path was already working. */
export const UNRESPONSIVE_HOST_HINT = "It may be overloaded, asleep, or off the network.";
