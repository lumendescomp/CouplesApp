# 🎯 Guia de Boas Práticas - HeartSync

## 📚 Documentação Técnica para Manutenção e Evolução

---

## 🔥 Boas Práticas Implementadas

### 1. Socket.IO
✅ **Instância Global Única**
```javascript
// ✅ CORRETO
const socket = window.getGlobalSocket();

// ❌ EVITAR
const socket = io(); // Cria nova conexão sempre
```

✅ **Cleanup de Listeners**
```javascript
// ✅ CORRETO
if (window._myHandler) {
  socket.off('event', window._myHandler);
}
window._myHandler = function(data) { /* ... */ };
socket.on('event', window._myHandler);

// ❌ EVITAR
socket.on('event', (data) => { /* ... */ }); // Sem cleanup
```

✅ **Salas (Rooms)**
```javascript
// ✅ CORRETO - Ao entrar
socket.emit('join-couple', coupleId);

// ✅ CORRETO - Ao sair (se necessário)
socket.emit('leave-couple', coupleId);
// OU no servidor: socket.leave(`couple-${coupleId}`);

// ❌ EVITAR - Nunca sair da sala
```

---

### 2. Event Listeners (DOM)

✅ **Prevenção de Duplicação**
```javascript
// ✅ CORRETO - Opção 1: Flag de inicialização
if (window._myComponentInitialized) return;
window._myComponentInitialized = true;
button.addEventListener('click', handler);

// ✅ CORRETO - Opção 2: Remover antes de adicionar
if (button._clickHandler) {
  button.removeEventListener('click', button._clickHandler);
}
button._clickHandler = handler;
button.addEventListener('click', handler);

// ✅ CORRETO - Opção 3: Event delegation (melhor para listas)
document.addEventListener('click', (e) => {
  if (e.target.matches('.my-button')) {
    // handler
  }
});

// ❌ EVITAR
button.addEventListener('click', () => { /* ... */ }); // Sem cleanup
```

✅ **Uso de `once`**
```javascript
// ✅ CORRETO - Para eventos únicos
button.addEventListener('click', handler, { once: true });

// ❌ EVITAR - Para eventos que só devem acontecer uma vez
button.addEventListener('click', () => {
  // Se usuário clicar 2x, executa 2x
});
```

---

### 3. Timers (setTimeout/setInterval)

✅ **Armazenar IDs e Limpar**
```javascript
// ✅ CORRETO
const timers = [];

function scheduleActions() {
  // Limpar timers antigos
  timers.forEach(id => clearTimeout(id));
  timers.length = 0;
  
  // Criar novos
  timers.push(setTimeout(action1, 100));
  timers.push(setTimeout(action2, 500));
}

function cleanup() {
  timers.forEach(id => clearTimeout(id));
  timers.length = 0;
}

// ❌ EVITAR
setTimeout(action1, 100); // Sem armazenar ID
setTimeout(action2, 500); // Impossível cancelar
```

✅ **Verificar Contexto Antes de Executar**
```javascript
// ✅ CORRETO
setTimeout(() => {
  if (document.body.contains(element)) {
    // Elemento ainda existe no DOM
    element.classList.add('active');
  }
}, 1000);

// ❌ EVITAR
setTimeout(() => {
  element.classList.add('active'); // Pode dar erro se elemento foi removido
}, 1000);
```

---

### 4. HTMX Lifecycle

✅ **Cleanup no beforeSwap**
```javascript
// ✅ CORRETO
document.addEventListener('htmx:beforeSwap', (e) => {
  const currentPath = window.location.pathname;
  const targetURL = e.detail.xhr?.responseURL || '';
  
  // Limpar recursos da página atual
  if (currentPath.includes('/my-page') && !targetURL.includes('/my-page')) {
    // Cleanup timers
    if (window._myPageTimers) {
      window._myPageTimers.forEach(id => clearTimeout(id));
    }
    
    // Cleanup listeners
    if (window._myPageCleanup) {
      window._myPageCleanup();
    }
  }
});

// ❌ EVITAR - Sem cleanup
// Recursos continuam ativos após sair da página
```

✅ **Re-inicialização Segura no afterSwap**
```javascript
// ✅ CORRETO
document.addEventListener('htmx:afterSwap', (e) => {
  // Verificar se componente já foi inicializado
  if (!e.detail.target.hasAttribute('data-initialized')) {
    e.detail.target.setAttribute('data-initialized', 'true');
    initializeComponent(e.detail.target);
  }
});

// ❌ EVITAR
document.addEventListener('htmx:afterSwap', (e) => {
  initializeComponent(e.detail.target); // Pode inicializar múltiplas vezes
});
```

---

### 5. Scripts Dinâmicos (Modal/AJAX)

✅ **Executar Apenas Uma Vez**
```javascript
// ✅ CORRETO
let scriptsExecuted = false;

function loadContent() {
  fetch('/content').then(html => {
    container.innerHTML = html;
    
    if (!scriptsExecuted) {
      scriptsExecuted = true;
      executeScripts(container);
    }
  });
}

// ❌ EVITAR
function loadContent() {
  fetch('/content').then(html => {
    container.innerHTML = html;
    executeScripts(container); // Executa toda vez
  });
}
```

✅ **Isolamento de Escopo**
```javascript
// ✅ CORRETO - IIFE para evitar poluir escopo global
(function() {
  const myVar = 'local';
  // código...
})();

// ❌ EVITAR
var myVar = 'global'; // Polui window
// código...
```

---

### 6. Imagens e Media

✅ **Lazy Loading**
```html
<!-- ✅ CORRETO -->
<img src="/photo.jpg" loading="lazy" alt="Foto">

<!-- ❌ EVITAR -->
<img src="/photo.jpg" alt="Foto"> <!-- Carrega imediatamente -->
```

✅ **Cancelamento de Requests**
```javascript
// ✅ CORRETO - Fetch com AbortController
const controller = new AbortController();

fetch('/api/data', { signal: controller.signal })
  .then(data => /* ... */)
  .catch(err => {
    if (err.name === 'AbortError') {
      console.log('Request cancelado');
    }
  });

// Ao sair da página
document.addEventListener('htmx:beforeSwap', () => {
  controller.abort();
});

// ❌ EVITAR
fetch('/api/data').then(data => /* ... */); // Sem cancelamento
```

✅ **Limpeza de Object URLs**
```javascript
// ✅ CORRETO
const objectUrl = URL.createObjectURL(blob);
img.src = objectUrl;

img.onload = () => {
  URL.revokeObjectURL(objectUrl); // Libera memória
};

// ❌ EVITAR
const objectUrl = URL.createObjectURL(blob);
img.src = objectUrl;
// Memory leak: URL nunca é liberado
```

---

### 7. Console Logs

✅ **Wrapper para Produção**
```javascript
// ✅ CORRETO
const isDev = window.location.hostname === 'localhost';

const log = (...args) => {
  if (isDev) {
    console.log(...args);
  }
};

log('[Chat] Mensagem recebida'); // Só exibe em dev

// ❌ EVITAR
console.log('[Chat] Mensagem recebida'); // Sempre exibe
```

---

### 8. Closures e Memory Leaks

✅ **Evitar Closures Desnecessárias**
```javascript
// ✅ CORRETO
function createHandler(id) {
  return function() {
    processId(id);
  };
}
button.addEventListener('click', createHandler(userId));

// ❌ EVITAR
users.forEach(user => {
  // Closure mantém referência a TODOS os users
  button.addEventListener('click', () => {
    console.log(users); // Memory leak
  });
});
```

✅ **Limpar Referências**
```javascript
// ✅ CORRETO
let bigData = loadBigData();
processBigData(bigData);
bigData = null; // Libera para GC

// ❌ EVITAR
let bigData = loadBigData();
processBigData(bigData);
// bigData nunca é liberado
```

---

## 🚨 Antipadrões (O que NÃO fazer)

### ❌ 1. Múltiplas Instâncias de Socket.IO
```javascript
// ❌ MAL
function openChat() {
  const socket = io(); // Nova conexão toda vez
}

// ✅ BOM
const socket = window.getGlobalSocket(); // Reutiliza conexão
```

### ❌ 2. Event Listeners Sem Cleanup
```javascript
// ❌ MAL
function init() {
  button.addEventListener('click', handler);
  // Chamado múltiplas vezes = listeners duplicados
}

// ✅ BOM
function init() {
  if (window._initialized) return;
  window._initialized = true;
  button.addEventListener('click', handler);
}
```

### ❌ 3. Timers Sem Cancelamento
```javascript
// ❌ MAL
function animate() {
  setTimeout(() => {
    updateUI();
    animate(); // Loop infinito
  }, 1000);
}

// ✅ BOM
let animationTimer = null;
function animate() {
  animationTimer = setTimeout(() => {
    if (shouldContinue) {
      updateUI();
      animate();
    }
  }, 1000);
}
function stopAnimation() {
  clearTimeout(animationTimer);
}
```

### ❌ 4. Acessar DOM Removido
```javascript
// ❌ MAL
setTimeout(() => {
  element.classList.add('active'); // Element pode não existir mais
}, 1000);

// ✅ BOM
setTimeout(() => {
  if (document.body.contains(element)) {
    element.classList.add('active');
  }
}, 1000);
```

### ❌ 5. Poluir Escopo Global
```javascript
// ❌ MAL
var myData = [];
function myFunction() { /* ... */ }

// ✅ BOM
window.MyModule = (function() {
  const myData = [];
  function myFunction() { /* ... */ }
  return { myFunction };
})();
```

---

## 🧪 Checklist de Review

Antes de fazer merge/deploy, verificar:

### Performance
- [ ] Nenhuma nova instância de Socket.IO criada (usar global)
- [ ] Event listeners têm cleanup ou flag de inicialização
- [ ] Timers são armazenados e limpos
- [ ] Imagens usam `loading="lazy"`
- [ ] Requests HTTP podem ser cancelados se necessário

### Memory Leaks
- [ ] Socket.IO listeners são removidos com `socket.off()`
- [ ] DOM listeners são removidos ou delegados
- [ ] Closures não capturam objetos grandes
- [ ] Object URLs são revogados após uso
- [ ] Referências grandes são anuladas após uso

### HTMX
- [ ] Cleanup de recursos em `htmx:beforeSwap`
- [ ] Re-inicialização segura em `htmx:afterSwap`
- [ ] Scripts dinâmicos executam apenas uma vez

### Debugging
- [ ] Console.logs usam wrapper para produção
- [ ] Erros são tratados adequadamente
- [ ] Logs têm prefixos claros ([Chat], [Badge], etc)

### UX
- [ ] Animações são suaves
- [ ] Scroll funciona corretamente
- [ ] Focus management é adequado
- [ ] Loading states são mostrados

---

## 📊 Ferramentas de Monitoramento

### Chrome DevTools

**Memory Profiler**:
1. DevTools → Performance → Memory
2. Take heap snapshot
3. Interagir com aplicação
4. Take novo snapshot
5. Compare → verificar crescimento anormal

**Network Monitor**:
1. DevTools → Network → WS
2. Verificar número de conexões WebSocket
3. Deve ter apenas 1 conexão ativa

**Performance Monitor**:
1. DevTools → More tools → Performance monitor
2. Observar: JS heap size, DOM nodes, Event listeners
3. Valores devem estabilizar, não crescer indefinidamente

### Testes Automatizados

```javascript
// Teste de Memory Leak
describe('Chat Modal', () => {
  it('should not leak memory on multiple open/close', async () => {
    const initialMemory = performance.memory.usedJSHeapSize;
    
    // Abrir/fechar 20x
    for (let i = 0; i < 20; i++) {
      await openModal();
      await closeModal();
    }
    
    // Forçar GC (apenas em browser com flag)
    if (window.gc) window.gc();
    
    const finalMemory = performance.memory.usedJSHeapSize;
    const leak = finalMemory - initialMemory;
    
    // Leak deve ser < 5MB
    expect(leak).toBeLessThan(5 * 1024 * 1024);
  });
});
```

---

## 🎓 Recursos para Estudo

### Socket.IO
- [Documentação Oficial](https://socket.io/docs/)
- [Rooms & Namespaces](https://socket.io/docs/v4/rooms/)
- [Best Practices](https://socket.io/docs/v4/performance-tuning/)

### HTMX
- [Documentação Oficial](https://htmx.org/docs/)
- [Events & Lifecycle](https://htmx.org/events/)
- [Examples](https://htmx.org/examples/)

### JavaScript Performance
- [MDN: Memory Management](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Memory_Management)
- [Web.dev: Performance](https://web.dev/performance/)
- [JavaScript Event Loops](https://javascript.info/event-loop)

### Memory Leaks
- [Google: Fix Memory Problems](https://developer.chrome.com/docs/devtools/memory-problems/)
- [Common JS Memory Leaks](https://javascript.info/memory-leaks)

---

## 🚀 Roadmap de Melhorias

### Curto Prazo (1-2 semanas)
1. ✅ Implementar Socket.IO global
2. ✅ Prevenir scripts duplicados
3. ✅ Cleanup de timers
4. ✅ Cleanup de listeners
5. [ ] Remover console.logs em produção
6. [ ] Adicionar lazy loading em todas imagens

### Médio Prazo (1 mês)
7. [ ] Implementar sistema de lifecycle hooks robusto
8. [ ] Adicionar AbortController em todos fetches
9. [ ] Implementar service worker para cache
10. [ ] Otimizar bundle size (tree shaking)

### Longo Prazo (3 meses)
11. [ ] Migrar para TypeScript
12. [ ] Adicionar testes automatizados de memory leaks
13. [ ] Implementar monitoramento de performance em produção
14. [ ] Adicionar error tracking (Sentry)

---

## 📝 Conclusão

Este guia documenta as **boas práticas essenciais** para manter a aplicação HeartSync:
- ✅ Eficiente em memória
- ✅ Performática
- ✅ Sem memory leaks
- ✅ Escalável

**Regra de ouro**: Sempre perguntar:
1. Este código pode criar memory leak?
2. Este código será executado múltiplas vezes?
3. Como limpar recursos ao sair?

Se a resposta para 1 ou 2 for "sim", revisar o código antes de commit!

---

**Mantido por**: Equipe HeartSync  
**Última atualização**: 11 de outubro de 2025  
**Próxima revisão**: Mensalmente
