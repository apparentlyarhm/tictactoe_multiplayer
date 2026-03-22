# backend/Dockerfile

# For the Go module to work with Nakama it needs to be compiled using the same version of Go 
# as was used to compile the Nakama binary itself.

# Therefore the number after is important
FROM heroiclabs/nakama-pluginbuilder:3.37.0 AS builder

ENV GO111MODULE on
ENV CGO_ENABLED 1

WORKDIR /backend

COPY . .

RUN go build --trimpath --buildmode=plugin -o ./backend.so

FROM heroiclabs/nakama:3.37.0

COPY --from=builder /backend/backend.so /nakama/data/modules/