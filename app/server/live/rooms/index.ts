// Registro ESTÁTICO das LiveRoom classes — usado no build de produção.
//
// Em dev, as rooms são auto-descobertas varrendo este diretório (import dinâmico).
// Em PROD isso quebraria (import do disco carrega uma instância separada do
// @fluxstack/live → context null). Aqui declaramos as rooms estaticamente para
// entrarem no bundle e serem registradas no LiveServer({ rooms }).
//
// Ao adicionar uma room nova em rooms/, inclua-a aqui também (ou rode o gerador).
import { ChatRoom } from './ChatRoom'
import { CounterRoom } from './CounterRoom'
import { DirectoryRoom } from './DirectoryRoom'
import { PingRoom } from './PingRoom'

export const liveRoomClasses = [ChatRoom, CounterRoom, DirectoryRoom, PingRoom]
