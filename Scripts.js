document.addEventListener('DOMContentLoaded', () => {

    const telaMenu = document.getElementById('menu-screen');
    const telaOverlay = document.getElementById('simulation-screen-overlay');
    const telaPaginacao = document.getElementById('simulation-screen-pagination');

    document.getElementById('overlay-menu-btn').addEventListener('click', () => {
        telaMenu.style.display = 'none';
        telaOverlay.style.display = 'block';
        simulacaoOverlay.resetar();
    });

    document.getElementById('pagination-menu-btn').addEventListener('click', () => {
        telaMenu.style.display = 'none';
        telaPaginacao.style.display = 'block';
        simulacaoPaginacao.resetar();
    });

    document.querySelectorAll('.back-button').forEach(botao => {
        botao.addEventListener('click', () => {
            simulacaoOverlay.parar();
            simulacaoPaginacao.parar();
            telaOverlay.style.display = 'none';
            telaPaginacao.style.display = 'none';
            telaMenu.style.display = 'flex';
        });
    });

    //criação das simulações
    const simulacaoOverlay = criarSimulacao({
        idTela: 'simulation-screen-overlay',
        usarEnderecamento: false,
        incluirProcessoPrincipal: true
    });

    const simulacaoPaginacao = criarSimulacao({
        idTela: 'simulation-screen-pagination',
        usarEnderecamento: true,
        incluirProcessoPrincipal: false
    });
});

function criarSimulacao(config) {
    const tela = document.getElementById(config.idTela);
    const botaoSimulacao = tela.querySelector('.simulation-btn');
    const botaoRecarregar = tela.querySelector('.reload-btn');
    const TAMANHO_PAGINA = 1024;

    let estado = {
        rodando: false, contagemProcessos: {}, proximoEnderecoLivre: 0,
        processoPrincipalFinalizadoEsperando: false, fila: [], ativos: [],
        concluidos: [], intervaloSimulacao: null, animacoesAtivas: [], timeoutsAtivos: []
    };

    function alternarSimulacao() {
        if (!estado.rodando) {
            estado.rodando = true;
            botaoSimulacao.textContent = 'Parar Simulação';
            botaoSimulacao.classList.add('stop-btn');
            botaoRecarregar.style.display = 'inline-block';
            tentarAlocarProcesso();
        } else {
            pararSimulacao();
        }
    }

    function pararSimulacao() {
        estado.rodando = false;
        pausarTodosProcessos();
        moverTodosParaFinalizadosComAtraso();
        clearTimeout(estado.intervaloSimulacao);
        botaoSimulacao.textContent = 'Iniciar Simulação';
        botaoSimulacao.classList.remove('stop-btn');
        botaoSimulacao.classList.remove('completed-btn');
        botaoSimulacao.disabled = false;
    }

    function resetarSimulacao() {
        pararSimulacao();
        estado = {
            ...estado, rodando: false, contagemProcessos: {}, proximoEnderecoLivre: 0,
            processoPrincipalFinalizadoEsperando: false, fila: [], ativos: [], concluidos: [],
        };
        botaoRecarregar.style.display = 'none';
        tela.querySelectorAll('.box-wrapper').forEach(caixa => {
            caixa.querySelector('.box-label').textContent = 'Espaço Livre';
            caixa.querySelector('.progress').style.height = '0%';
        });
        if (config.incluirProcessoPrincipal) {
            estado.fila.push({ nome: 'Processo Principal', id: 'proc_principal' });
        }
        for (let i = 1; i <= 10; i++) {
            const nome = `Subrotina ${i}`;
            const processo = { nome: nome, id: `${nome.replace(' ', '_')}_${obterRepeticoes(nome)}` };
            if (config.usarEnderecamento) {
                const enderecoInicio = estado.proximoEnderecoLivre;
                const enderecoFim = enderecoInicio + TAMANHO_PAGINA - 1;
                processo.endereco = `${enderecoInicio} - ${enderecoFim}`;
                estado.proximoEnderecoLivre += TAMANHO_PAGINA;
            }
            estado.fila.push(processo);
        }
        renderizarListas();
    }

    // função para marcar a simulação como concluída
    function marcarSimulacaoComoConcluida() {
        estado.rodando = false;
        clearTimeout(estado.intervaloSimulacao);
        botaoSimulacao.textContent = 'Simulação concluída!!';
        botaoSimulacao.classList.remove('stop-btn');
        botaoSimulacao.classList.add('completed-btn');
        botaoSimulacao.disabled = true;
    }

    function tentarAlocarProcesso() {
        if (!estado.rodando) return;

        const caixasLivres = Array.from(tela.querySelectorAll('.box-wrapper')).filter(c => c.querySelector('.box-label').textContent === 'Espaço Livre');
        caixasLivres.forEach(caixaLivre => {
            if (estado.fila.length > 0) {
                let processoParaAlocar;
                if (config.incluirProcessoPrincipal) {
                    const principalJaAtivo = estado.ativos.some(p => p.nome === 'Processo Principal');
                    const principalNaFilaIndex = estado.fila.findIndex(p => p.nome === 'Processo Principal');
                    if (!principalJaAtivo && principalNaFilaIndex !== -1) {
                        processoParaAlocar = estado.fila.splice(principalNaFilaIndex, 1)[0];
                    } else if (principalNaFilaIndex === -1) {
                        processoParaAlocar = estado.fila.shift();
                    }
                } else {
                    processoParaAlocar = estado.fila.shift();
                }
                if (processoParaAlocar) {
                    estado.ativos.push(processoParaAlocar);
                    incrementarContagemProcesso(processoParaAlocar.nome);
                    const tempo = obterTempoProcesso(processoParaAlocar.nome);
                    caixaLivre.querySelector('.box-label').textContent = processoParaAlocar.nome;
                    caixaLivre.dataset.processoId = processoParaAlocar.id;
                    iniciarAnimacaoProgresso(caixaLivre, processoParaAlocar, tempo);
                }
            }
        });
        renderizarListas();
        estado.intervaloSimulacao = setTimeout(tentarAlocarProcesso, 500);
    }

    function lidarComConclusaoProcesso(processoConcluido, caixa) {
        if (config.incluirProcessoPrincipal) {
            if (processoConcluido.nome === 'Processo Principal') {
                estado.processoPrincipalFinalizadoEsperando = true;
                verificarFimSimulacaoOverlay();
                return;
            }
            finalizarEreagendar(processoConcluido, caixa);
            verificarFimSimulacaoOverlay();
        } else {
            finalizarEreagendar(processoConcluido, caixa);
            if (estado.fila.length === 0 && estado.ativos.length === 0) {
                marcarSimulacaoComoConcluida();
            }
        }
    }

    function finalizarEreagendar(processo, caixa) {
        caixa.querySelector('.progress').style.height = '0%';
        caixa.querySelector('.box-label').textContent = 'Espaço Livre';
        caixa.dataset.processoId = '';
        estado.ativos = estado.ativos.filter(p => p.id !== processo.id);
        estado.concluidos.push(processo);
        if (podeExecutarProcesso(processo.nome)) {
            agendarProximaExecucao(processo.nome);
        }
        renderizarListas();
    }

    function verificarFimSimulacaoOverlay() {
        if (!estado.processoPrincipalFinalizadoEsperando) return;
        const subRotinasRestantes = estado.fila.length > 0 || estado.ativos.some(p => p.nome !== 'Processo Principal');
        if (!subRotinasRestantes) {
            const caixaPrincipal = Array.from(tela.querySelectorAll('.box-wrapper')).find(c => c.querySelector('.box-label').textContent === 'Processo Principal');
            const processoPrincipal = estado.ativos.find(p => p.nome === 'Processo Principal');
            if (caixaPrincipal && processoPrincipal) {
                finalizarEreagendar(processoPrincipal, caixaPrincipal);
            }
            marcarSimulacaoComoConcluida();
        }
    }

    function agendarProximaExecucao(nomeProcesso) {
        const contagem = estado.contagemProcessos[nomeProcesso] || 0;
        const processo = { nome: nomeProcesso, id: `${nomeProcesso.replace(' ', '_')}_${contagem}` };
        if (config.usarEnderecamento) {
            const enderecoInicio = estado.proximoEnderecoLivre;
            const enderecoFim = enderecoInicio + TAMANHO_PAGINA - 1;
            processo.endereco = `${enderecoInicio} - ${enderecoFim}`;
            estado.proximoEnderecoLivre += TAMANHO_PAGINA;
        }
        estado.fila.push(processo);
        renderizarListas();
    }

    function renderizarListas() {
        const colunas = tela.querySelectorAll('.process-column');
        if (config.usarEnderecamento) {
            renderizarLista(colunas[0].querySelector('.process-list'), estado.fila);
            renderizarLista(colunas[1].querySelector('.process-list'), estado.ativos);
            renderizarLista(colunas[2].querySelector('.process-list'), estado.concluidos);
        } else {
            renderizarLista(colunas[0].querySelector('.process-list'), estado.fila);
            renderizarLista(colunas[1].querySelector('.process-list'), estado.concluidos);
        }
    }

    function renderizarLista(ulElement, listaDeProcessos) {
        ulElement.innerHTML = '';
        listaDeProcessos.forEach(processo => {
            const itemLista = document.createElement('li');
            if (config.usarEnderecamento) {
                itemLista.innerHTML = `<span>${processo.nome}</span> <span>${processo.endereco || ''}</span>`;
            } else {
                itemLista.textContent = processo.nome;
            }
            ulElement.appendChild(itemLista);
        });
    }

    function iniciarAnimacaoProgresso(caixa, processo, tempoProcesso) {
        const barraProgresso = caixa.querySelector('.progress');
        barraProgresso.style.height = '0%';
        let inicio = Date.now();
        const tempoVisual = Math.min(tempoProcesso, 10000);
        function atualizarProgresso() {
            if (caixa.dataset.processoId !== processo.id) {
                barraProgresso.style.height = '0%';
                return;
            }
            const tempoDecorrido = Date.now() - inicio;
            const porcentagem = Math.min((tempoDecorrido / tempoVisual) * 100, 100);
            barraProgresso.style.height = `${porcentagem}%`;
            if (porcentagem < 100) {
                estado.animacoesAtivas.push(requestAnimationFrame(atualizarProgresso));
            } else {
                estado.timeoutsAtivos.push(setTimeout(() => {
                    lidarComConclusaoProcesso(processo, caixa);
                }, tempoProcesso - tempoVisual));
            }
        }
        estado.animacoesAtivas.push(requestAnimationFrame(atualizarProgresso));
    }

    function moverTodosParaFinalizadosComAtraso() {
        [...estado.fila, ...estado.ativos].forEach(proc => estado.concluidos.push(proc));
        estado.fila = [];
        estado.ativos = [];
        renderizarListas();
    }

    function pausarTodosProcessos() {
        estado.animacoesAtivas.forEach(animacao => cancelAnimationFrame(animacao));
        estado.animacoesAtivas = [];
        estado.timeoutsAtivos.forEach(timeout => clearTimeout(timeout));
        estado.timeoutsAtivos = [];
    }

    function obterTempoProcesso(nomeProcesso) {
        switch (nomeProcesso) {
            case 'Processo Principal': return 10000; case 'Subrotina 1': return 5000;
            case 'Subrotina 2': return 4000; case 'Subrotina 3': return 6000;
            case 'Subrotina 4': return 8000; case 'Subrotina 5': return 3000;
            case 'Subrotina 6': return 5000; case 'Subrotina 7': return 7000;
            case 'Subrotina 8': return 3000; case 'Subrotina 9': return 9000;
            case 'Subrotina 10': return 4000; default: return 5000;
        }
    }

    function obterRepeticoes(nomeProcesso) {
        switch (nomeProcesso) {
            case 'Processo Principal': return 1; case 'Subrotina 1': return 3;
            case 'Subrotina 2': return 5; case 'Subrotina 3': return 3;
            case 'Subrotina 4': return 4; case 'Subrotina 5': return 5;
            case 'Subrotina 6': return 4; case 'Subrotina 7': return 3;
            case 'Subrotina 8': return 3; case 'Subrotina 9': return 4;
            case 'Subrotina 10': return 4; default: return 1;
        }
    }

    function podeExecutarProcesso(nomeProcesso) {
        if (nomeProcesso === 'Processo Principal') return (estado.contagemProcessos[nomeProcesso] || 0) < 1;
        const contagemAtual = estado.contagemProcessos[nomeProcesso] || 0;
        return contagemAtual < obterRepeticoes(nomeProcesso);
    }

    function incrementarContagemProcesso(nomeProcesso) {
        estado.contagemProcessos[nomeProcesso] = (estado.contagemProcessos[nomeProcesso] || 0) + 1;
    }

    botaoSimulacao.addEventListener('click', alternarSimulacao);
    botaoRecarregar.addEventListener('click', resetarSimulacao);

    return {
        resetar: resetarSimulacao,
        parar: pararSimulacao
    };
}