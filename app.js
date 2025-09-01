import {
    auth,
    onAuthStateChanged,
    signOut,
    db,
    doc,
    getDoc,
    collection,
    getDocs,
    setDoc,
    deleteDoc,
    updateDoc,
    functions,
    httpsCallable
} from './firebase-config.js';

const { createApp, ref, onMounted, computed, nextTick } = Vue;
const { createVuetify } = Vuetify;
const { jsPDF } = window.jspdf;

const App = {
    setup() {
        const userEmail = ref("");
        const lugares = ref([]);
        const selectedLugar = ref(null);
        const showModal = ref(false);
        const loading = ref(true);
        const menu = ref(false);
        const userAvatar = ref('https://cdn.vuetifyjs.com/docs/images/logos/vuetify-logo-light-slim.svg');

        const records = ref([]);
        const recordForm = ref({});
        const dialog = ref(false);
        const dateDialog = ref(false);
        const selectedDate = ref(null);
        const isEditMode = ref(false);
        const originalNum = ref(null);
        const confirmSaveDialog = ref(false);
        const numRecetaInput = ref(null);

        // Referencia para el diálogo arrastrable
        const dialogRef = ref(null);

        // Variables para el diálogo de confirmación de eliminación
        const confirmDialog = ref(false);
        const recordToDelete = ref(null);

        const headers = [
            { title: 'Centro de Salud', key: 'centro' },
            { title: 'Tipo de Receta', key: 'tipo' },
            { title: 'Fecha Receta', key: 'fecha' },
            { title: 'Num Receta', key: 'num' },
            { title: 'Hora Entra', key: 'hentra' },
            { title: 'Hora Digita', key: 'hdigita' },
            { title: 'Hora Acopio', key: 'hacopio' },
            { title: 'Hora Revisa', key: 'hrevisa' },
            { title: 'Usuario', key: 'usuario' },
            { title: 'Acciones', key: 'actions', sortable: false },
        ];

        const tipoRecetaOptions = ['CONSULTA', 'EMERGENCIAS', 'COPIAS'];

        const consultaCount = ref(0);
        const emergenciaCount = ref(0);
        const copiaCount = ref(0);

        const filtroMes = ref(null);
        const filtroAno = ref('');
        const meses = [
            { nombre: 'ENERO', valor: 0 }, { nombre: 'FEBRERO', valor: 1 }, { nombre: 'MARZO', valor: 2 },
            { nombre: 'ABRIL', valor: 3 }, { nombre: 'MAYO', valor: 4 }, { nombre: 'JUNIO', valor: 5 },
            { nombre: 'JULIO', valor: 6 }, { nombre: 'AGOSTO', valor: 7 }, { nombre: 'SEPTIEMBRE', valor: 8 },
            { nombre: 'OCTUBRE', valor: 9 }, { nombre: 'NOVIEMBRE', valor: 10 }, { nombre: 'DICIEMBRE', valor: 11 },
        ];
        
        const snackbar = ref(false);
        const snackbarText = ref('');
        const snackbarColor = ref('info');

        const calculateMinutesDifference = (startTime, endTime) => {
            const [startHour, startMinute] = startTime.split(':').map(Number);
            const [endHour, endMinute] = endTime.split(':').map(Number);
            const startInMinutes = startHour * 60 + startMinute;
            const endInMinutes = endHour * 60 + endMinute;
            const diff = endInMinutes - startInMinutes;
            return diff;
        };

        const formatMinutesToHHMM = (totalMinutes) => {
            if (isNaN(totalMinutes) || totalMinutes < 0) return '00:00';
            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;
            return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
        };

        const parseDate = (s) => {
            if (!s) return null;
            const [d, m, y] = s.split('/');
            return new Date(y, m - 1, d);
        };
        
        const showSnackbar = (text, color = 'info') => {
            snackbarText.value = text;
            snackbarColor.value = color;
            snackbar.value = true;
        };

        const totalesGlobales = computed(() => {
            const totalRecetas = records.value.length;
            const tiemposTotales = records.value
                .filter(r => r.hentra && r.hrevisa)
                .map(r => calculateMinutesDifference(r.hentra, r.hrevisa))
                .filter(diff => diff >= 0);

            const promedioGlobal = tiemposTotales.length > 0
                ? Math.round(tiemposTotales.reduce((a, b) => a + b, 0) / tiemposTotales.length)
                : 0;

            return {
                totalRecetas,
                promedioGlobal: formatMinutesToHHMM(promedioGlobal)
            };
        });

        const registrosFiltrados = computed(() => {
            let arr = [...records.value];
            if (filtroMes.value !== null) {
                arr = arr.filter(r => {
                    const d = parseDate(r.fecha);
                    return d && d.getMonth() === filtroMes.value;
                });
            }
            if (filtroAno.value) {
                arr = arr.filter(r => {
                    const d = parseDate(r.fecha);
                    return d && d.getFullYear() === parseInt(filtroAno.value);
                });
            }
            consultaCount.value = arr.filter(r => r.tipo === 'CONSULTA').length;
            emergenciaCount.value = arr.filter(r => r.tipo === 'EMERGENCIAS').length;
            copiaCount.value = arr.filter(r => r.tipo === 'COPIAS').length;
            return arr;
        });

        const promedios = computed(() => {
            const tiempos = { CONSULTA: [], EMERGENCIAS: [], COPIAS: [] };
            registrosFiltrados.value.forEach(record => {
                if (record.hentra && record.hrevisa) {
                    const diff = calculateMinutesDifference(record.hentra, record.hrevisa);
                    if (tiempos[record.tipo] && diff >= 0) {
                        tiempos[record.tipo].push(diff);
                    }
                }
            });

            const consultaProm = tiempos.CONSULTA.length > 0
                ? Math.round(tiempos.CONSULTA.reduce((a, b) => a + b, 0) / tiempos.CONSULTA.length)
                : 0;
            const emergenciaProm = tiempos.EMERGENCIAS.length > 0
                ? Math.round(tiempos.EMERGENCIAS.reduce((a, b) => a + b, 0) / tiempos.EMERGENCIAS.length)
                : 0;
            const copiaProm = tiempos.COPIAS.length > 0
                ? Math.round(tiempos.COPIAS.reduce((a, b) => a + b, 0) / tiempos.COPIAS.length)
                : 0;

            const consultaMin = tiempos.CONSULTA.length > 0 ? formatMinutesToHHMM(Math.min(...tiempos.CONSULTA)) : 'N/A';
            const consultaMax = tiempos.CONSULTA.length > 0 ? formatMinutesToHHMM(Math.max(...tiempos.CONSULTA)) : 'N/A';
            const emergenciaMin = tiempos.EMERGENCIAS.length > 0 ? formatMinutesToHHMM(Math.min(...tiempos.EMERGENCIAS)) : 'N/A';
            const emergenciaMax = tiempos.EMERGENCIAS.length > 0 ? formatMinutesToHHMM(Math.max(...tiempos.EMERGENCIAS)) : 'N/A';
            const copiaMin = tiempos.COPIAS.length > 0 ? formatMinutesToHHMM(Math.min(...tiempos.COPIAS)) : 'N/A';
            const copiaMax = tiempos.COPIAS.length > 0 ? formatMinutesToHHMM(Math.max(...tiempos.COPIAS)) : 'N/A';

            return {
                consultaProm: formatMinutesToHHMM(consultaProm),
                emergenciaProm: formatMinutesToHHMM(emergenciaProm),
                copiaProm: formatMinutesToHHMM(copiaProm),
                consultaMin,
                consultaMax,
                emergenciaMin,
                emergenciaMax,
                copiaMin,
                copiaMax
            };
        });

        const promedioMesAnterior = computed(() => {
            const currentMonth = filtroMes.value;
            const currentYear = parseInt(filtroAno.value);

            if (currentMonth === null || isNaN(currentYear)) {
                return {
                    consulta: 'N/A',
                    emergencia: 'N/A',
                    copia: 'N/A'
                };
            }

            const mesAnterior = currentMonth === 0 ? 11 : currentMonth - 1;
            const anoAnterior = currentMonth === 0 ? currentYear - 1 : currentYear;

            const recordsMesAnterior = records.value.filter(r => {
                const d = parseDate(r.fecha);
                return d && d.getMonth() === mesAnterior && d.getFullYear() === anoAnterior;
            });

            const tiempos = { CONSULTA: [], EMERGENCIAS: [], COPIAS: [] };
            recordsMesAnterior.forEach(record => {
                if (record.hentra && record.hrevisa) {
                    const diff = calculateMinutesDifference(record.hentra, record.hrevisa);
                    if (tiempos[record.tipo] && diff >= 0) {
                        tiempos[record.tipo].push(diff);
                    }
                }
            });

            const consultaProm = tiempos.CONSULTA.length > 0 ? Math.round(tiempos.CONSULTA.reduce((a, b) => a + b, 0) / tiempos.CONSULTA.length) : 0;
            const emergenciaProm = tiempos.EMERGENCIAS.length > 0 ? Math.round(tiempos.EMERGENCIAS.reduce((a, b) => a + b, 0) / tiempos.EMERGENCIAS.length) : 0;
            const copiaProm = tiempos.COPIAS.length > 0 ? Math.round(tiempos.COPIAS.reduce((a, b) => a + b, 0) / tiempos.COPIAS.length) : 0;

            return {
                consulta: formatMinutesToHHMM(consultaProm),
                emergencia: formatMinutesToHHMM(emergenciaProm),
                copia: formatMinutesToHHMM(copiaProm)
            };
        });

        const reporteCompleto = computed(() => {
            const tipos = ['CONSULTA', 'EMERGENCIAS', 'COPIAS'];
            const data = { 'CONSULTA': {}, 'EMERGENCIAS': {}, 'COPIAS': {} };
            const months = [];
            
            const hoy = new Date();
            const mesActual = hoy.getMonth();
            const anoActual = hoy.getFullYear();

            const getMonthName = (month) => meses.find(m => m.valor === month)?.nombre;

            // Recolectar datos por mes para los últimos 3 meses
            for (let i = 0; i < 3; i++) {
                let mes = (mesActual - i + 12) % 12;
                let ano = anoActual;
                if (mesActual - i < 0) {
                    ano--;
                }
                months.push({ mes, ano, label: i === 0 ? 'Mes Actual' : (i === 1 ? 'Anterior' : 'TrasAnterior') });
            }
            
            // Inicializar la estructura de datos
            tipos.forEach(tipo => {
                data[tipo].meses = {};
                data[tipo].total = { cantidad: 0, tiempos: [] };
                months.forEach(({ mes, ano, label }) => {
                    data[tipo].meses[label] = { cantidad: 0, tiempos: [], nombreMes: getMonthName(mes) };
                });
            });

            // Llenar la estructura con los datos de los registros
            records.value.forEach(record => {
                const d = parseDate(record.fecha);
                if (!d) return;

                const mes = d.getMonth();
                const ano = d.getFullYear();
                const tipo = record.tipo;

                if (record.hentra && record.hrevisa) {
                    const diff = calculateMinutesDifference(record.hentra, record.hrevisa);
                    if (diff >= 0) {
                        // Agregar al total general
                        data[tipo].total.tiempos.push(diff);
                        data[tipo].total.cantidad++;

                        // Agregar al mes correspondiente
                        months.forEach(({ mes: m, ano: a, label }) => {
                            if (mes === m && ano === a) {
                                data[tipo].meses[label].cantidad++;
                                data[tipo].meses[label].tiempos.push(diff);
                            }
                        });
                    }
                }
            });

            // Calcular promedios finales
            tipos.forEach(tipo => {
                // Promedio del total
                const totalData = data[tipo].total;
                totalData.promedio = totalData.tiempos.length > 0
                    ? formatMinutesToHHMM(Math.round(totalData.tiempos.reduce((a, b) => a + b, 0) / totalData.tiempos.length))
                    : '00:00';
                delete totalData.tiempos;

                // Promedios por mes
                Object.keys(data[tipo].meses).forEach(mesLabel => {
                    const mesData = data[tipo].meses[mesLabel];
                    mesData.promedio = mesData.tiempos.length > 0
                        ? formatMinutesToHHMM(Math.round(mesData.tiempos.reduce((a, b) => a + b, 0) / mesData.tiempos.length))
                        : '00:00';
                    delete mesData.tiempos;
                });
            });

            return data;
        });

        const exportToPDF = () => {
            if (!selectedLugar.value) {
                showSnackbar("Por favor, selecciona un lugar de atención primero.", "warning");
                return;
            }

            const doc = new jsPDF();
            const ebaisNombre = selectedLugar.value;
            const reportData = reporteCompleto.value;
            const globalTotals = totalesGlobales.value;
            const tipos = {
                'CONSULTA': 'Consulta Externa',
                'EMERGENCIAS': 'Urgencias',
                'COPIAS': 'Subsecuentes'
            };

            const tiposColores = {
                'CONSULTA': [24, 103, 192], // #1867c0
                'EMERGENCIAS': [22, 151, 246], // #1697f6
                'COPIAS': [123, 198, 255], // #7bc6ff
            };

            let yPos = 20;

            doc.setFontSize(16);
            doc.text(`Reporte de Tiempos - ${ebaisNombre}`, 105, yPos, { align: 'center' });
            yPos += 10;
            doc.setFontSize(12);
            doc.text(`Generado el: ${new Date().toLocaleDateString('es-ES')}`, 105, yPos, { align: 'center' });
            yPos += 20;

            // Sección de Totales Generales
            doc.setFontSize(14);
            doc.text('Totales Generales (Sin filtros de mes/año)', 105, yPos, { align: 'center' });
            yPos += 5;
            doc.autoTable({
                startY: yPos,
                head: [['Total Recetas', 'Promedio Global']],
                body: [[globalTotals.totalRecetas, globalTotals.promedioGlobal]],
                theme: 'striped',
                styles: {
                    fontSize: 10,
                    halign: 'center'
                },
                headStyles: {
                    fillColor: [0, 100, 200]
                }
            });
            yPos = doc.autoTable.previous.finalY + 15;

            // Sección de Totales por tipo de receta
            Object.keys(tipos).forEach(tipoKey => {
                const tipoLabel = tipos[tipoKey];
                const headers = [['Mes', 'Cantidad Recetas', 'Promedio']];
                const data = [];
                
                // Agregar datos de los tres meses recientes
                const mesesData = reportData[tipoKey].meses;
                Object.keys(mesesData).forEach(mesLabel => {
                    const row = mesesData[mesLabel];
                    data.push([
                        `${mesLabel.replace('Anterior', ' Anterior').replace('Tras', 'TrasAnterior').trim()} (${row.nombreMes.toLowerCase()})`,
                        row.cantidad,
                        row.promedio
                    ]);
                });

                // Agregar el total
                const totalData = reportData[tipoKey].total;
                data.push(['Total', totalData.cantidad, totalData.promedio]);

                doc.setFontSize(14);
                doc.text(tipoLabel, 20, yPos);
                yPos += 5;

                doc.autoTable({
                    startY: yPos,
                    head: headers,
                    body: data,
                    theme: 'striped',
                    styles: {
                        fontSize: 10,
                        halign: 'center'
                    },
                    headStyles: {
                        fillColor: tiposColores[tipoKey]
                    },
                    didDrawPage: function (data) {
                        // Pie de página con el número de página
                        doc.text('Página ' + doc.internal.getNumberOfPages(), data.settings.margin.left, doc.internal.pageSize.height - 10);
                    }
                });
                yPos = doc.autoTable.previous.finalY + 15;
            });
            
            const codigoEbais = ebaisNombre.split(" - ")[0];
            doc.save(`reporte-trimestral-${codigoEbais}.pdf`);
        };

        const logout = async () => {
            await signOut(auth);
            window.location.href = "login.html";
        };

        const cargarDatosEbais = async (codigoEbais) => {
            records.value = [];
            try {
                const colRef = collection(db, "Recetas", codigoEbais, "RecetasDetalle");
                const snapshot = await getDocs(colRef);
                snapshot.forEach(docSnap => {
                    const data = docSnap.data();
                    records.value.push({
                        id: docSnap.id,
                        centro: selectedLugar.value,
                        tipo: data.tipo,
                        fecha: data.fecha,
                        num: docSnap.id,
                        hentra: data.hentra,
                        hdigita: data.hdigita,
                        hacopio: data.hacopio,
                        hrevisa: data.hrevisa,
                        usuario: data.usuario,
                        createdAt: data.createdAt || null
                    });
                });
                records.value.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            } catch (err) {
                console.error("Error al cargar registros del EBAIS:", err);
                showSnackbar("Error al cargar registros del EBAIS.", "error");
            }
        };

        const seleccionarLugar = async (lugar) => {
            selectedLugar.value = lugar;
            showModal.value = false;
            const codigoEbais = lugar.split(" - ")[0];
            await cargarDatosEbais(codigoEbais);
        };

        const addRecord = () => {
            isEditMode.value = false;
            originalNum.value = null;
            recordForm.value = {
                centro: selectedLugar.value || '',
                tipo: '',
                fecha: '',
                num: '',
                hentra: '',
                hdigita: '',
                hacopio: '',
                hrevisa: '',
                usuario: userEmail.value,
                createdAt: Date.now()
            };
            selectedDate.value = null;
            dialog.value = true;
            nextTick(() => {
                if (numRecetaInput.value) {
                    numRecetaInput.value.focus();
                }
            });
        };
        
        const saveRecord = () => {
            const { hentra, hdigita, hacopio, hrevisa, num } = recordForm.value;
            if (!hentra || !hdigita || !hacopio || !hrevisa || !num || !recordForm.value.fecha) {
                showSnackbar("Debes completar todas las horas, fecha y número de receta antes de guardar.", "warning");
                return;
            }
            const parseTime = t => t.split(':').map(Number);
            const compareTimes = (t1, t2) => t1[0] * 60 + t1[1] <= t2[0] * 60 + t2[1];
            const minTime = parseTime('06:00');
            const maxTime = parseTime('20:00');
            const times = [hentra, hdigita, hacopio, hrevisa].map(parseTime);

            let validationError = null;
            for (let i = 0; i < times.length; i++) {
                if (!compareTimes(minTime, times[i]) || !compareTimes(times[i], maxTime)) {
                    validationError = `La hora debe estar entre 06:00 y 20:00`;
                    break;
                }
                for (let j = 0; j < i; j++) {
                    if (!compareTimes(times[j], times[i])) {
                        validationError = `La hora ${['Entra', 'Digita', 'Acopio', 'Revisa'][i]} no puede ser menor a la hora ${['Entra', 'Digita', 'Acopio', 'Revisa'][j]}`;
                    break;
                    }
                }
                if (validationError) break;
            }

            if (validationError) {
                showSnackbar(validationError, "warning");
                return;
            }
            
            confirmSaveDialog.value = true;
        };

        const proceedSave = async () => {
            const { num } = recordForm.value;
            const codigoEbais = selectedLugar.value.split(" - ")[0];
            const docRef = doc(db, "Recetas", codigoEbais, "RecetasDetalle", num);

            try {
                if (!isEditMode.value) {
                    const snap = await getDoc(docRef);
                    if (snap.exists()) {
                        showSnackbar("⚠️ Esta receta ya existe. No se puede guardar duplicada.", "warning");
                        confirmSaveDialog.value = false;
                        return;
                    }
                    await setDoc(docRef, { ...recordForm.value });
                    showSnackbar("✅ Registro añadido exitosamente.", "success");
                } else {
                    await updateDoc(docRef, { ...recordForm.value });
                    showSnackbar("✅ Registro actualizado exitosamente.", "success");
                }
            } catch (err) {
                console.error("Error guardando en Firestore:", err);
                showSnackbar("Error guardando en Firestore. Revisa la consola.", "error");
                confirmSaveDialog.value = false;
                return;
            }
            const index = records.value.findIndex(r => r.num === num);
            if (index === -1) {
                records.value.push({ ...recordForm.value });
            } else {
                records.value[index] = { ...recordForm.value };
            }
            records.value.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
            confirmSaveDialog.value = false;
            // Corregido: En lugar de resetear todo el formulario, solo limpiamos los campos necesarios
            recordForm.value.num = '';
            recordForm.value.hentra = '';
            recordForm.value.hdigita = '';
            recordForm.value.hacopio = '';
            recordForm.value.hrevisa = '';
            nextTick(() => {
                if (numRecetaInput.value) {
                    numRecetaInput.value.focus();
                }
            });
        };

        const editRecord = (num) => {
            const rec = records.value.find(r => r.num === num);
            if (!rec) return;
            isEditMode.value = true;
            originalNum.value = rec.num;
            recordForm.value = { ...rec };
            selectedDate.value = rec.fecha ? parseDate(rec.fecha) : null;
            dialog.value = true;
            nextTick(() => {
                if (numRecetaInput.value) {
                    numRecetaInput.value.focus();
                }
            });
        };

        const confirmRemove = (num) => {
            recordToDelete.value = num;
            confirmDialog.value = true;
        };

        const removeRecord = async () => {
            if (!recordToDelete.value) return;

            const codigoEbais = selectedLugar.value.split(" - ")[0];
            try {
                await deleteDoc(doc(db, "Recetas", codigoEbais, "RecetasDetalle", recordToDelete.value));
                showSnackbar("✅ Registro eliminado exitosamente.", "success");
            } catch (err) {
                console.error("Error eliminando en Firestore:", err);
                showSnackbar("Error eliminando en Firestore. Revisa la consola.", "error");
            }
            records.value = records.value.filter(r => r.num !== recordToDelete.value);
            confirmDialog.value = false;
            recordToDelete.value = null;
        };

        const formatDate = (d) => {
            const date = new Date(d);
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            return `${day}/${month}/${year}`;
        };

        const confirmDate = () => {
            if (selectedDate.value) {
                recordForm.value.fecha = formatDate(selectedDate.value);
            }
            dateDialog.value = false;
        };
        
        const tipoIcon = (tipo) => {
            if (tipo === 'CONSULTA') return 'mdi-stethoscope';
            if (tipo === 'EMERGENCIAS') return 'mdi-hospital-box-outline';
            if (tipo === 'COPIAS') return 'mdi-content-copy';
            return '';
        };

        onMounted(() => {
            // Lógica para hacer el diálogo arrastrable
            let isDragging = false;
            let currentX;
            let currentY;
            let initialX;
            let initialY;
            let xOffset = 0;
            let yOffset = 0;

            const dragStart = (e) => {
                if (e.target.closest('.draggable-handle')) {
                    initialX = e.clientX - xOffset;
                    initialY = e.clientY - yOffset;
                    isDragging = true;
                }
            };

            const dragEnd = () => {
                initialX = currentX;
                initialY = currentY;
                isDragging = false;
            };

            const drag = (e) => {
                if (isDragging) {
                    e.preventDefault();
                    currentX = e.clientX - initialX;
                    currentY = e.clientY - initialY;

                    xOffset = currentX;
                    yOffset = currentY;

                    if (dialogRef.value) {
                        const dialogElement = dialogRef.value.$el.querySelector('.v-overlay__content');
                        if (dialogElement) {
                            dialogElement.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
                        }
                    }
                }
            };

            document.addEventListener('mousedown', dragStart);
            document.addEventListener('mouseup', dragEnd);
            document.addEventListener('mousemove', drag);
            
            const today = new Date();
            filtroMes.value = today.getMonth();
            filtroAno.value = today.getFullYear().toString();

            onAuthStateChanged(auth, async (user) => {
                if (!user) {
                    window.location.href = "login.html";
                } else {
                    userEmail.value = user.email;
                    try {
                        const userDoc = await getDoc(doc(db, "usuarios", user.email));
                        if (userDoc.exists()) {
                            const userData = userDoc.data();
                            if (userData.ebaisAutorizados && userData.ebaisAutorizados.length > 0) {
                                if (userData.ebaisAutorizados.length === 1) {
                                    selectedLugar.value = `${userData.ebaisAutorizados[0].Codigo} - ${userData.ebaisAutorizados[0].Ebais}`;
                                    await cargarDatosEbais(userData.ebaisAutorizados[0].Codigo);
                                } else {
                                    lugares.value = userData.ebaisAutorizados.map(e => `${e.Codigo} - ${e.Ebais}`);
                                    showModal.value = true;
                                }
                            } else {
                                showSnackbar("No tienes lugares de atención asignados.", "warning");
                            }
                        } else {
                            showSnackbar("No se encontraron permisos para este usuario", "warning");
                        }
                    } catch (err) {
                        console.error(err);
                        showSnackbar("Error al cargar tus permisos. Revisa tu conexión o Firestore.", "error");
                    }
                    loading.value = false;
                }
            });
        });

        const tiempoPreparacion = computed(() => {
            if (recordForm.value.hentra && recordForm.value.hrevisa) {
                const diff = calculateMinutesDifference(recordForm.value.hentra, recordForm.value.hrevisa);
                return formatMinutesToHHMM(diff);
            }
            return 'N/A';
        });

        const tipoColor = (tipo) => {
            if (tipo === 'CONSULTA') return '#1867c0';
            if (tipo === 'EMERGENCIAS') return '#1697f6';
            if (tipo === 'COPIAS') return '#7bc6ff';
            return '';
        };

        return {
            userEmail, lugares, selectedLugar, showModal, seleccionarLugar,
            loading, menu, userAvatar, logout,
            records, registrosFiltrados, headers, recordForm, dialog, addRecord, saveRecord, proceedSave, editRecord,
            confirmDialog, recordToDelete, confirmRemove, removeRecord,
            confirmSaveDialog,
            dateDialog, selectedDate, confirmDate, tipoRecetaOptions,
            isEditMode, consultaCount, emergenciaCount, copiaCount, tipoColor,
            filtroMes, filtroAno, meses,
            promedios,
            promedioMesAnterior,
            reporteCompleto, exportToPDF,
            snackbar, snackbarText, snackbarColor,
            tiempoPreparacion,
            numRecetaInput,
            dialogRef,
            tipoIcon,
            totalesGlobales
        };
    },
    template: `
        <v-app>
            <v-card height="100">
                <v-toolbar class="text-white" image="https://cdn.vuetifyjs.com/images/backgrounds/vbanner.jpg">
                    <v-menu v-model="menu" :close-on-content-click="false" location="start">
                        <template v-slot:activator="{ props }">
                            <v-btn icon v-bind="props">
                                <v-icon>mdi-menu</v-icon>
                            </v-btn>
                        </template>
                        <v-card min-width="300">
                            <v-list>
                                <v-list-item
                                    :prepend-avatar="userAvatar"
                                    :title="selectedLugar"
                                    :subtitle="userEmail"
                                />
                            </v-list>
                        </v-card>
                    </v-menu>

                    <v-toolbar-title>Dashboard</v-toolbar-title>
                    <v-spacer></v-spacer>
                    <v-btn icon @click="logout">
                        <v-icon>mdi-logout</v-icon>
                    </v-btn>
                </v-toolbar>
            </v-card>

            <v-main class="pa-4">
                <v-row class="mb-4">
                    <v-col cols="12">
                        <v-card class="pa-3 d-flex flex-column" style="background-color: #2c3e50; border-radius: 12px; color: white;">
                            <div class="d-flex align-center justify-space-between mb-1">
                                <div class="text-h6 font-weight-bold">Total General</div>
                                <v-icon size="36">mdi-chart-bar</v-icon>
                            </div>
                            <v-divider class="my-1" color="white"></v-divider>
                            <div class="d-flex justify-space-around text-center">
                                <div>
                                    <div class="text-body-2 font-weight-light">Recetas</div>
                                    <div class="text-h4 font-weight-bold">{{ totalesGlobales.totalRecetas }}</div>
                                </div>
                                <div>
                                    <div class="text-body-2 font-weight-light">Promedio</div>
                                    <div class="text-h4 font-weight-bold">{{ totalesGlobales.promedioGlobal }}</div>
                                </div>
                            </div>
                        </v-card>
                    </v-col>
                </v-row>
                
                <v-row class="mb-4" dense>
                    <v-col cols="6" md="3">
                        <v-select v-model="filtroMes" :items="meses" item-title="nombre" item-value="valor" label="Mes" dense></v-select>
                    </v-col>
                    <v-col cols="6" md="3">
                        <v-text-field v-model="filtroAno" label="Año" type="text" dense></v-text-field>
                    </v-col>
                </v-row>
                
                <v-row class="mb-4" dense>
                    <v-col cols="12" md="4">
                        <v-card class="pa-3 d-flex flex-column" style="background-color: #1867c0; border-radius: 12px; color: white;">
                            <div class="d-flex align-center justify-space-between mb-1">
                                <div class="text-subtitle-2 font-weight-bold">CONSULTA</div>
                                <v-icon size="30">mdi-stethoscope</v-icon>
                            </div>
                            <div class="text-h5 font-weight-bold mb-1">Recetas: {{ consultaCount }}</div>
                            <div class="text-body-2">Promedio: {{ promedios.consultaProm }}</div>
                            <v-divider class="my-2" color="white"></v-divider>
                            <div class="text-caption">
                                <div>Promedio mes anterior: {{ promedioMesAnterior.consulta }}</div>
                                <div>Mínimo: {{ promedios.consultaMin }}</div>
                                <div>Máximo: {{ promedios.consultaMax }}</div>
                            </div>
                        </v-card>
                    </v-col>
                    <v-col cols="12" md="4">
                        <v-card class="pa-3 d-flex flex-column" style="background-color: #1697f6; border-radius: 12px; color: white;">
                            <div class="d-flex align-center justify-space-between mb-1">
                                <div class="text-subtitle-2 font-weight-bold">EMERGENCIAS</div>
                                <v-icon size="30">mdi-hospital-box-outline</v-icon>
                            </div>
                            <div class="text-h5 font-weight-bold mb-1">Recetas: {{ emergenciaCount }}</div>
                            <div class="text-body-2">Promedio: {{ promedios.emergenciaProm }}</div>
                            <v-divider class="my-2" color="white"></v-divider>
                            <div class="text-caption">
                                <div>Promedio mes anterior: {{ promedioMesAnterior.emergencia }}</div>
                                <div>Mínimo: {{ promedios.emergenciaMin }}</div>
                                <div>Máximo: {{ promedios.emergenciaMax }}</div>
                            </div>
                        </v-card>
                    </v-col>
                    <v-col cols="12" md="4">
                        <v-card class="pa-3 d-flex flex-column" style="background-color: #7bc6ff; border-radius: 12px; color: black;">
                            <div class="d-flex align-center justify-space-between mb-1">
                                <div class="text-subtitle-2 font-weight-bold">COPIAS</div>
                                <v-icon size="30">mdi-content-copy</v-icon>
                            </div>
                            <div class="text-h5 font-weight-bold mb-1">Recetas: {{ copiaCount }}</div>
                            <div class="text-body-2">Promedio: {{ promedios.copiaProm }}</div>
                            <v-divider class="my-2" color="black"></v-divider>
                            <div class="text-caption">
                                <div>Promedio mes anterior: {{ promedioMesAnterior.copia }}</div>
                                <div>Mínimo: {{ promedios.copiaMin }}</div>
                                <div>Máximo: {{ promedios.copiaMax }}</div>
                            </div>
                        </v-card>
                    </v-col>
                </v-row>

                <v-dialog v-model="showModal" max-width="400">
                    <v-card>
                        <v-card-title>Selecciona un lugar de atención</v-card-title>
                        <v-card-text>
                            <v-list>
                                <v-list-item v-for="lugar in lugares" :key="lugar" @click="seleccionarLugar(lugar)">
                                    <v-list-item-title>{{ lugar }}</v-list-item-title>
                                </v-list-item>
                            </v-list>
                        </v-card-text>
                    </v-card>
                </v-dialog>

                <v-card>
                    <v-card-title class="d-flex justify-space-between align-center">
                        <v-btn color="primary" @click="addRecord" :disabled="!selectedLugar">Añadir registro</v-btn>
                        <v-btn color="blue-grey" class="ms-2" @click="exportToPDF" :disabled="!selectedLugar">Exportar a PDF</v-btn>
                    </v-card-title>
                    <v-data-table :headers="headers" :items="registrosFiltrados" :loading="loading" loading-text="Cargando registros..." no-data-text="No hay datos disponibles.">
                        <template v-slot:item.tipo="{ item }">
                            <v-chip :color="tipoColor(item.tipo)" dark>{{ item.tipo }}</v-chip>
                        </template>
                        <template v-slot:item.actions="{ item }">
                            <div class="d-flex gap-2 justify-end">
                                <v-btn icon color="blue" @click="editRecord(item.num)">
                                    <v-icon>mdi-pencil</v-icon>
                                </v-btn>
                                <v-btn icon color="red" @click="confirmRemove(item.num)">
                                    <v-icon>mdi-delete</v-icon>
                                </v-btn>
                            </div>
                        </template>
                    </v-data-table>
                </v-card>

                <v-dialog v-model="dialog" max-width="600" ref="dialogRef">
                    <v-card>
                        <v-card-title class="headline draggable-handle">{{ isEditMode ? 'Editar' : 'Nuevo' }} Registro</v-card-title>
                        <v-card-text>
                            <v-container>
                                <v-row dense>
                                    <v-col cols="12" md="6">
                                        <v-select
                                            v-model="recordForm.tipo"
                                            :items="tipoRecetaOptions"
                                            label="Tipo de Receta"
                                            required
                                        ></v-select>
                                    </v-col>
                                    <v-col cols="12" md="6">
                                        <v-text-field
                                            v-model="recordForm.fecha"
                                            label="Fecha de Receta (DD/MM/YYYY)"
                                            @click="dateDialog = true"
                                            readonly
                                            required
                                        ></v-text-field>
                                    </v-col>
                                </v-row>
                                <v-row dense>
                                    <v-col cols="12">
                                        <v-text-field
                                            v-model="recordForm.num"
                                            :ref="numRecetaInput"
                                            label="Número de Receta"
                                            type="number"
                                            :disabled="isEditMode"
                                            required
                                        ></v-text-field>
                                    </v-col>
                                </v-row>
                                <v-row dense>
                                    <v-col cols="12" md="6">
                                        <v-text-field v-model="recordForm.hentra" label="Hora de Entrada" type="time" required></v-text-field>
                                    </v-col>
                                    <v-col cols="12" md="6">
                                        <v-text-field v-model="recordForm.hdigita" label="Hora de Digitación" type="time" required></v-text-field>
                                    </v-col>
                                </v-row>
                                <v-row dense>
                                    <v-col cols="12" md="6">
                                        <v-text-field v-model="recordForm.hacopio" label="Hora de Acopio" type="time" required></v-text-field>
                                    </v-col>
                                    <v-col cols="12" md="6">
                                        <v-text-field v-model="recordForm.hrevisa" label="Hora de Revisión" type="time" required></v-text-field>
                                    </v-col>
                                </v-row>
                            </v-container>
                        </v-card-text>
                        <v-card-actions>
                            <v-spacer></v-spacer>
                            <v-btn color="grey" @click="dialog = false">Cancelar</v-btn>
                            <v-btn color="primary" @click="saveRecord">Guardar</v-btn>
                        </v-card-actions>
                    </v-card>
                </v-dialog>

                <v-dialog v-model="confirmSaveDialog" max-width="500">
                    <v-card class="rounded-xl">
                        <v-card-title class="bg-primary text-white text-center py-4">
                            <div class="d-flex align-center justify-center">
                                <v-icon size="36" class="me-2">mdi-check-circle-outline</v-icon>
                                <span>Confirmar Registro</span>
                            </div>
                        </v-card-title>
                        <v-card-text class="text-center pa-6">
                            <v-icon size="80" :color="tipoColor(recordForm.tipo)">{{ tipoIcon(recordForm.tipo) }}</v-icon>
                            <p class="text-h5 font-weight-bold mt-2 mb-1">{{ recordForm.tipo }}</p>
                            <v-divider class="my-4"></v-divider>
                            <p class="text-h6">Tiempo de preparación:</p>
                            <p class="text-h4 font-weight-bold">{{ tiempoPreparacion }}</p>
                            <v-divider class="my-4"></v-divider>
                            <p class="text-subtitle-1">¿Estás seguro de que deseas guardar este registro?</p>
                        </v-card-text>
                        <v-card-actions class="d-flex justify-center pa-4">
                            <v-btn color="grey" variant="flat" @click="confirmSaveDialog = false">Cancelar</v-btn>
                            <v-btn color="primary" variant="flat" @click="proceedSave">Guardar</v-btn>
                        </v-card-actions>
                    </v-card>
                </v-dialog>
                
                <v-dialog v-model="confirmDialog" max-width="500">
                    <v-card>
                        <v-card-title class="headline">Confirmar eliminación</v-card-title>
                        <v-card-text>¿Estás seguro de que quieres eliminar el registro con el número de receta <strong>{{ recordToDelete }}</strong>? Esta acción no se puede deshacer.</v-card-text>
                        <v-card-actions>
                            <v-spacer></v-spacer>
                            <v-btn color="grey" text @click="confirmDialog = false">Cancelar</v-btn>
                            <v-btn color="red" text @click="removeRecord">Eliminar</v-btn>
                        </v-card-actions>
                    </v-card>
                </v-dialog>

                <v-dialog v-model="dateDialog" max-width="320">
                    <v-card>
                        <v-card-title>Seleccionar Fecha</v-card-title>
                        <v-date-picker v-model="selectedDate" @update:model-value="confirmDate"></v-date-picker>
                    </v-card>
                </v-dialog>

                <v-snackbar v-model="snackbar" :color="snackbarColor" :timeout="3000">
                    {{ snackbarText }}
                </v-snackbar>
            </v-main>
        </v-app>
    `
};

const vuetify = createVuetify();
createApp(App).use(vuetify).mount('#app');