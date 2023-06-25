import { WebSocketServer, WebSocketGateway } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { AppointmentService } from 'src/appointment/appointment.service';

@WebSocketGateway()
export class SocketGateway {
  @WebSocketServer()
  server: Server;

  sendObjectToClients(
    appointment: Awaited<
      ReturnType<typeof AppointmentService.prototype.getAppointments>
    >,
  ) {
    this.server.emit('appointment', appointment);
  }
}
