const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { v4: uuidv4 } = require('uuid');

const app = express();
const servidor = http.createServer(app);
const io = socketIo(servidor);

// Estructura de cada sala
const sales = {};

app.use(express.static('public'));

io.on('connection', socket => {
  socket.nom = null;
  socket.sales = new Set();

  // Registrar nom d'usuari
  socket.on('registre_usuari', nom => {
    socket.nom = nom;
  });

  // Unir-se a una sala
  socket.on('unir_sala', sala => {
    if (!socket.nom) return;

    socket.join(sala);
    socket.sales.add(sala);

    // Crear la sala si no existeix
    if (!sales[sala]) {
      sales[sala] = {
        creador: socket.nom,
        admins: new Set([socket.nom]),
        missatges: [],
        usuaris: new Set(),
        ancorat: null
      };
    }

    // Afegir usuari a la sala
    sales[sala].usuaris.add(socket.nom);

    // Enviar missatges existents
    sales[sala].missatges.forEach(missatge => {
      socket.emit('missatge_sala', { sala, ...missatge });
    });

    // Enviar missatge ancorat (si existeix)
    if (sales[sala].ancorat) {
      socket.emit('missatge_ancorat', { sala, missatge: sales[sala].ancorat });
    }

    // Enviar llista d'administradors
    socket.emit('admins_sala', {
      sala,
      admins: Array.from(sales[sala].admins),
      creador: sales[sala].creador
    });

    // Actualitzar llista d'usuaris per a tothom
    actualitzarUsuarisSala(sala);
  });

  // Rebre un missatge nou
  socket.on('missatge_sala', ({ sala, text }) => {
    if (!sales[sala]) return;

    const nouMissatge = {
      id: uuidv4(),
      nom: socket.nom,
      text
    };

    sales[sala].missatges.push(nouMissatge);
    io.to(sala).emit('missatge_sala', { sala, ...nouMissatge });
  });

  // Esborrar un missatge concret (si ets admin)
  socket.on('esborrar_missatge', ({ sala, id }) => {
    const salaInfo = sales[sala];
    if (salaInfo && salaInfo.admins.has(socket.nom)) {
      salaInfo.missatges = salaInfo.missatges.filter(m => m.id !== id);
      io.to(sala).emit('missatge_esborrat', { sala, id });

      // Si era el missatge ancorat, desancorar
      if (salaInfo.ancorat?.id === id) {
        salaInfo.ancorat = null;
        io.to(sala).emit('missatge_ancorat', { sala, missatge: null });
      }
    }
  });

  // Esborrar tots els missatges d'una sala
  socket.on('esborrar_tots_missatges', sala => {
    const salaInfo = sales[sala];
    if (salaInfo && salaInfo.admins.has(socket.nom)) {
      const ids = salaInfo.missatges.map(m => m.id);
      salaInfo.missatges = [];
      salaInfo.ancorat = null;

      ids.forEach(id => {
        io.to(sala).emit('missatge_esborrat', { sala, id });
      });

      io.to(sala).emit('missatge_ancorat', { sala, missatge: null });
    }
  });

  // Ancorar un missatge
  socket.on('ancorar_missatge', ({ sala, id }) => {
    const salaInfo = sales[sala];
    if (salaInfo && salaInfo.admins.has(socket.nom)) {
      const missatge = salaInfo.missatges.find(m => m.id === id);
      salaInfo.ancorat = missatge || null;
      io.to(sala).emit('missatge_ancorat', { sala, missatge: salaInfo.ancorat });
    }
  });

  // Desancorar el missatge
  socket.on('desancorar_missatge', sala => {
    const salaInfo = sales[sala];
    if (salaInfo && salaInfo.admins.has(socket.nom)) {
      salaInfo.ancorat = null;
      io.to(sala).emit('missatge_ancorat', { sala, missatge: null });
    }
  });

  // Designar un nou admin
  socket.on('fer_admin', ({ sala, nouAdmin }) => {
    const salaInfo = sales[sala];
    if (salaInfo && salaInfo.admins.has(socket.nom)) {
      salaInfo.admins.add(nouAdmin);
      io.to(sala).emit('admins_sala', {
        sala,
        admins: Array.from(salaInfo.admins),
        creador: salaInfo.creador
      });
      actualitzarUsuarisSala(sala);
    }
  });

  // Treure un admin (només el creador pot)
  socket.on('treure_admin', ({ sala, user }) => {
    const salaInfo = sales[sala];
    if (socket.nom === salaInfo?.creador && salaInfo.admins.has(user)) {
      salaInfo.admins.delete(user);
      io.to(sala).emit('admins_sala', {
        sala,
        admins: Array.from(salaInfo.admins),
        creador: salaInfo.creador
      });
      actualitzarUsuarisSala(sala);
    }
  });

  // Quan un usuari es desconnecta
  socket.on('disconnect', () => {
    if (!socket.nom) return;

    socket.sales.forEach(sala => {
      if (sales[sala]) {
        sales[sala].usuaris.delete(socket.nom);
        actualitzarUsuarisSala(sala);
      }
    });
  });

  // Funció auxiliar per enviar la llista actualitzada d'usuaris
  function actualitzarUsuarisSala(sala) {
    const salaInfo = sales[sala];
    if (salaInfo) {
      io.to(sala).emit('usuaris_sala', {
        sala,
        usuaris: Array.from(salaInfo.usuaris),
        admins: Array.from(salaInfo.admins)
      });
    }
  }
});

servidor.listen(3000, () => {
  console.log('Servidor escoltant a http://localhost:3000');
});