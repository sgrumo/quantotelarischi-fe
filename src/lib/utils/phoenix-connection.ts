import { Channel, Socket } from 'phoenix'
import { RoomInfoSchema } from '../models/rooms'

const SOCKET_URL = 'ws://localhost:4000/socket'

export const connectToWebSocket = (roomId: string): Channel => {
    const socket = new Socket(SOCKET_URL, {
        logger: (kind, msg, data) => {
            console.log(`Phoenix ${kind}: ${msg}`, data)
        },
    })
    socket.connect()

    const channel = socket.channel(`room:${roomId}`)

    channel
        .join()
        .receive('ok', resp => {
            RoomInfoSchema.parse(resp)
            console.log('Joined room successfully', resp)
        })
        .receive('error', resp => {
            console.log('Unable to join', resp)
        })

    return channel
}
