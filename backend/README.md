# THE NAKAMA POWERED TIC TAC TOE: backend

The idea is, to use nakama, an open-source game server, which abstracts:

- **Authentication & Accounts:** Device ID registration, user accounts, and sessions.

- **Real-time Matchmaking:** Grouping players together based on custom criteria.

- **Multiplayer Sockets:** Low-latency WebSockets for sending game state data.

- **Database Management:** Automatically handles schema migrations and data storage.

Nakama exposes two primary ports:

- **7350:** The main unified port for all Game Client traffic (HTTP REST, WebSockets, and gRPC).

- **7351:** The Web Dashboard/Console for developers.

> [!NOTE]
> I never said anything about scale, I dont have much experience with how we would actually scale it to millions for cheap, I can try though..

Now, all it needs a db, so about that:

### *I set a goal for myself: to use Cloud Run (No VMs) and use my self hosted postgreSQL instance.*

### *Another limitation of cloud run is exposure of only one port. we need some sort of reverse proxy to expose both console and main socket stuff*

So all in all, I had a failed attempt for a 4-container server (see `pov.yaml`)

- nakama
- tailscale as a sidecar
- `socat` for socks5-tcp proxy
- `caddy` for reverse proxy

I could not get anything to startup on order and without rewriting much of the softwares used. I would need more time to get it working reliably (if it is even possible)

Anyways i ended up opting for a free db at [neondb](https://neon.com/) which eliminated `tailscale` and `socat`.

So, to summarise, This is how it is deployed:

![](/media/arch.png)