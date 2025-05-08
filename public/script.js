const socket = io();
let nom = '';
const sales = {};
let salaActiva = null;

// Quan es carrega la pàgina, demanem el nom de l'usuari i ho enviem al servidor
window.onload = () => {
  nom = prompt('Introdueix el teu nom:').trim() || 'Anònim';
  document.getElementById('userNameDisplay').textContent = nom;
  socket.emit('registre_usuari', nom);
};

// Crear una nova sala
function novaSala() {
  const sala = prompt('Nom de la nova sala:').trim();
  if (sala && !sales[sala]) {
    socket.emit('unir_sala', sala);
    unirSala(sala);
  }
}

// Afegir la nova sala al client
function unirSala(sala) {
  sales[sala] = { missatges: {}, usuaris: [], admins: [], creador: null };

  const li = document.createElement('li');
  li.className = 'nav-item';
  li.innerHTML = `
    <a class="nav-link" href="#" data-sala="${sala}">
      ${sala}<span class="badge bg-danger badge-notif d-none" id="notif-${sala}">!</span>
    </a>
  `;
  li.querySelector('a').onclick = () => canviarSala(sala);
  document.getElementById('pestanyes').appendChild(li);

  canviarSala(sala);
}

// Canviar la sala activa
function canviarSala(sala) {
  salaActiva = sala;

  document.querySelectorAll('.nav-link').forEach(el =>
    el.classList.toggle('active', el.dataset.sala === sala)
  );
  document.querySelectorAll('.badge-notif').forEach(b =>
    b.classList.add('d-none')
  );

  document.getElementById('missatgeAncorat').style.display = 'none';
  document.getElementById('textAncorat').innerHTML = '';
  document.getElementById('contingutSales').innerHTML = '';

  const msgsDiv = document.createElement('div');
  msgsDiv.id = `missatges-${sala}`;
  Object.values(sales[sala].missatges).forEach(b => msgsDiv.appendChild(b));

  document.getElementById('contingutSales').appendChild(msgsDiv);
  updateUsersPanel(sala);
}

// Enviar un missatge
function enviarMissatge() {
  if (!salaActiva) return;

  const input = document.getElementById('entrada');
  const text = input.value.trim();

  if (text) {
    socket.emit('missatge_sala', { sala: salaActiva, text });
    input.value = '';
  }
}

// Esborrar tots els missatges de la sala
function esborrarTotsMissatges() {
  if (confirm(`Esborrar tots els missatges de '${salaActiva}'?`)) {
    socket.emit('esborrar_tots_missatges', salaActiva);
  }
}

// Actualitzar la llista d'usuaris i mostrar controls si ets admin
function updateUsersPanel(sala) {
  const panel = document.getElementById('usersPanel');
  const list = document.getElementById('usuarisList');
  const btnClear = document.getElementById('btnClear');

  list.innerHTML = '';
  panel.classList.toggle('visible', sales[sala].usuaris.length > 0);
  btnClear.style.display = sales[sala].admins.includes(nom) ? 'block' : 'none';

  sales[sala].usuaris.forEach(u => {
    const li = document.createElement('li');
    li.textContent = u;

    if (sales[sala].admins.includes(u)) li.classList.add('admin');

    if (sales[sala].creador === nom && u !== nom && sales[sala].admins.includes(u)) {
      li.classList.add('clickable-revoke');
      li.onclick = () => {
        if (confirm(`Treure admin a ${u}?`)) socket.emit('treure_admin', { sala, user: u });
      };
    } else if (sales[sala].admins.includes(nom) && u !== nom && !sales[sala].admins.includes(u)) {
      li.classList.add('clickable-promote');
      li.onclick = () => {
        if (confirm(`Fer admin a ${u}?`)) socket.emit('fer_admin', { sala, nouAdmin: u });
      };
    }

    list.appendChild(li);
  });
}

// Mostrar missatge a la sala
socket.on('missatge_sala', ({ sala, id, nom: remitent, text }) => {
  if (!sales[sala]) return;

  const bubble = document.createElement('div');
  bubble.id = id;
  bubble.className = 'message-bubble ' + (remitent === nom ? 'me' : 'other');
  bubble.innerHTML = `<strong>${remitent}</strong><br>${text}`;

  // Si ets admin, pots esborrar o ancorar
  if (sales[sala].admins.includes(nom)) {
    const btnDel = document.createElement('button');
    btnDel.className = 'btn-delete';
    btnDel.innerHTML = '<i class="bi bi-trash"></i>';
    btnDel.onclick = () => socket.emit('esborrar_missatge', { sala, id });
    bubble.appendChild(btnDel);

    const btnPin = document.createElement('button');
    btnPin.className = 'btn-delete';
    btnPin.innerHTML = '<i class="bi bi-pin-angle"></i>';
    btnPin.title = 'Ancorar missatge';
    btnPin.onclick = () => socket.emit('ancorar_missatge', { sala, id });
    bubble.appendChild(btnPin);
  }

  sales[sala].missatges[id] = bubble;

  const container = document.getElementById(`missatges-${sala}`);
  if (sala === salaActiva && container) {
    container.appendChild(bubble);
  } else {
    document.getElementById(`notif-${sala}`).classList.remove('d-none');
  }
});

// Quan s'esborra un missatge
socket.on('missatge_esborrat', ({ sala, id }) => {
  if (sales[sala]?.missatges[id]) {
    sales[sala].missatges[id].remove();
    delete sales[sala].missatges[id];
  }
});

// Actualitzar usuaris i admins
socket.on('usuaris_sala', ({ sala, usuaris, admins }) => {
  if (!sales[sala]) return;
  sales[sala].usuaris = usuaris;
  sales[sala].admins = admins;

  if (sala === salaActiva) updateUsersPanel(sala);
});

// Mostrar botons d'admin quan canvia la llista d'administradors
socket.on('admins_sala', ({ sala, admins, creador }) => {
  if (!sales[sala]) return;

  sales[sala].admins = admins;
  sales[sala].creador = creador;

  if (sala === salaActiva && admins.includes(nom)) {
    updateUsersPanel(sala);

    document.querySelectorAll(`#missatges-${sala} .message-bubble`).forEach(bubble => {
      const id = bubble.id;

      if (!bubble.querySelector('.bi-trash')) {
        const btnDel = document.createElement('button');
        btnDel.className = 'btn-delete';
        btnDel.innerHTML = '<i class="bi bi-trash"></i>';
        btnDel.onclick = () => socket.emit('esborrar_missatge', { sala, id });
        bubble.appendChild(btnDel);
      }

      if (!bubble.querySelector('.bi-pin-angle')) {
        const btnPin = document.createElement('button');
        btnPin.className = 'btn-delete';
        btnPin.innerHTML = '<i class="bi bi-pin-angle"></i>';
        btnPin.title = 'Ancorar missatge';
        btnPin.onclick = () => socket.emit('ancorar_missatge', { sala, id });
        bubble.appendChild(btnPin);
      }
    });
  }
});

// Mostrar missatge ancorat
socket.on('missatge_ancorat', ({ sala, missatge }) => {
  if (sala !== salaActiva) return;

  const cont = document.getElementById('missatgeAncorat');
  const text = document.getElementById('textAncorat');

  if (missatge) {
    text.innerHTML = `<strong>${missatge.nom}</strong>: ${missatge.text}`;

    if (sales[sala]?.admins.includes(nom)) {
      const btnUnpin = document.createElement('button');
      btnUnpin.className = 'btn-delete';
      btnUnpin.innerHTML = '<i class="bi bi-x-circle"></i>';
      btnUnpin.title = 'Desancorar';
      btnUnpin.onclick = () => socket.emit('desancorar_missatge', sala);
      text.appendChild(btnUnpin);
    }

    cont.style.display = 'block';
  } else {
    cont.style.display = 'none';
    text.innerHTML = '';
  }
});
