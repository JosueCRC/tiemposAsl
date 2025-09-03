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
        const tiempoPreparacion = ref('N/A');

        const numRecetaInput = ref(null);
        const hentraInput = ref(null);
        const hdigitaInput = ref(null);
        const hacopioInput = ref(null);
        const hrevisaInput = ref(null);
        const saveButton = ref(null);

        const dialogRef = ref(null);

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
        
        const totalRecetasGeneral = computed(() => {
            return records.value.length;
        });

        const promedioRecetasGeneral = computed(() => {
            const tiempos = records.value.filter(r => r.hentra && r.hrevisa).map(r => calculateMinutesDifference(r.hentra, r.hrevisa));
            const total = tiempos.reduce((a, b) => a + b, 0);
            const promedio = tiempos.length > 0 ? Math.round(total / tiempos.length) : 0;
            return formatMinutesToHHMM(promedio);
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

        const reporteTrimestral = computed(() => {
            const tipos = ['CONSULTA', 'EMERGENCIAS', 'COPIAS'];
            const data = { 'CONSULTA': {}, 'EMERGENCIAS': {}, 'COPIAS': {} };
            const months = [];
            
            const hoy = new Date();
            const mesActual = hoy.getMonth();
            const anoActual = hoy.getFullYear();

            const getMonthName = (month) => meses.find(m => m.valor === month)?.nombre;

            for (let i = 0; i < 3; i++) {
                let mes = (mesActual - i + 12) % 12;
                let ano = anoActual;
                if (mesActual - i < 0) {
                    ano--;
                }
                months.push({ mes, ano });
            }
            
            tipos.forEach(tipo => {
                months.forEach(({ mes, ano }) => {
                    const mesKey = `${mes}-${ano}`;
                    data[tipo][mesKey] = { cantidad: 0, promedio: 0, nombreMes: getMonthName(mes) };
                });
            });

            records.value.forEach(record => {
                const d = parseDate(record.fecha);
                if (!d) return;

                const mes = d.getMonth();
                const ano = d.getFullYear();
                const mesKey = `${mes}-${ano}`;
                const tipo = record.tipo;

                if (data[tipo] && data[tipo][mesKey]) {
                    data[tipo][mesKey].cantidad++;
                    if (record.hentra && record.hrevisa) {
                        const diff = calculateMinutesDifference(record.hentra, record.hrevisa);
                        if (diff >= 0) {
                            if (!data[tipo][mesKey].tiempos) {
                                data[tipo][mesKey].tiempos = [];
                            }
                            data[tipo][mesKey].tiempos.push(diff);
                        }
                    }
                }
            });

            let totalGeneralRecetas = 0;
            let totalGeneralTiempos = [];

            tipos.forEach(tipo => {
                let totalTipoRecetas = 0;
                let totalTipoTiempos = [];

                Object.keys(data[tipo]).forEach(mesKey => {
                    const mesData = data[tipo][mesKey];
                    totalTipoRecetas += mesData.cantidad;
                    if (mesData.tiempos && mesData.tiempos.length > 0) {
                        const total = mesData.tiempos.reduce((a, b) => a + b, 0);
                        mesData.promedio = formatMinutesToHHMM(Math.round(total / mesData.tiempos.length));
                        totalTipoTiempos.push(...mesData.tiempos);
                    } else {
                        mesData.promedio = '00:00';
                    }
                    delete mesData.tiempos;
                });
                data[tipo].totalRecetas = totalTipoRecetas;
                const totalPromedio = totalTipoTiempos.length > 0 ? Math.round(totalTipoTiempos.reduce((a, b) => a + b, 0) / totalTipoTiempos.length) : 0;
                data[tipo].totalPromedio = formatMinutesToHHMM(totalPromedio);

                totalGeneralRecetas += totalTipoRecetas;
                totalGeneralTiempos.push(...totalTipoTiempos);
            });

            data.totalGeneralRecetas = totalGeneralRecetas;
            const totalGeneralPromedio = totalGeneralTiempos.length > 0 ? Math.round(totalGeneralTiempos.reduce((a, b) => a + b, 0) / totalGeneralTiempos.length) : 0;
            data.totalGeneralPromedio = formatMinutesToHHMM(totalGeneralPromedio);

            return data;
        });

        const exportToPDF = () => {
            if (!selectedLugar.value) {
                showSnackbar("Por favor, selecciona un lugar de atención primero.", "warning");
                return;
            }

            const doc = new jsPDF();
            const ebaisNombre = selectedLugar.value;
            const reportData = reporteTrimestral.value;
            const tipos = ['CONSULTA', 'EMERGENCIAS', 'COPIAS'];
            let yPos = 20;

            const tipoColorMap = {
                'CONSULTA': [24, 103, 192], // #1867c0
                'EMERGENCIAS': [22, 151, 246], // #1697f6
                'COPIAS': [123, 198, 255] // #7bc6ff
            };

            doc.setFontSize(16);
            doc.text("Reporte de Tiempos Trimestral", 105, yPos, { align: 'center' });
            yPos += 10;
            doc.setFontSize(12);
            doc.text(`Lugar de Atención: ${ebaisNombre}`, 105, yPos, { align: 'center' });
            yPos += 20;

            tipos.forEach(tipo => {
                const headers = [['Mes', 'Cantidad Recetas', 'Promedio (HH:MM)']];
                const data = [];
                const monthKeys = Object.keys(reportData[tipo]).filter(key => key.includes('-'));
                
                monthKeys.forEach(monthKey => {
                    const row = reportData[tipo][monthKey];
                    data.push([row.nombreMes.toUpperCase(), row.cantidad, row.promedio]);
                });
                
                data.push(['TOTAL', reportData[tipo].totalRecetas, reportData[tipo].totalPromedio]);
                const color = tipoColorMap[tipo];

                doc.text(tipo.toUpperCase(), 20, yPos);
                yPos += 5;
                doc.autoTable({
                    startY: yPos,
                    head: headers,
                    body: data,
                    styles: {
                        fontSize: 10,
                        halign: 'center'
                    },
                    headStyles: {
                        fillColor: color,
                        textColor: [255, 255, 255]
                    },
                    bodyStyles: {
                         textColor: [0, 0, 0]
                    },
                    didDrawCell: (data) => {
                        if (data.row.index === data.table.body.length - 1) {
                            doc.setFillColor(color[0], color[1], color[2]);
                            doc.setTextColor(255, 255, 255);
                        }
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
        
        const saveRecord = async () => {
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
            
            const diff = calculateMinutesDifference(recordForm.value.hentra, recordForm.value.hrevisa);
            tiempoPreparacion.value = formatMinutesToHHMM(diff);
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

        const focusNextField = (field) => {
            nextTick(() => {
                let nextField = null;
                switch (field) {
                    case 'num':
                        if (recordForm.value.num) {
                           nextField = hentraInput.value;
                        } else {
                           showSnackbar("El campo de número de receta es obligatorio.", "warning");
                           numRecetaInput.value.focus();
                           return;
                        }
                        break;
                    case 'hentra':
                        if (recordForm.value.hentra) {
                            nextField = hdigitaInput.value;
                        } else {
                            showSnackbar("El campo de hora de entrada es obligatorio.", "warning");
                            hentraInput.value.focus();
                            return;
                        }
                        break;
                    case 'hdigita':
                        if (recordForm.value.hdigita) {
                            nextField = hacopioInput.value;
                        } else {
                            showSnackbar("El campo de hora de digitación es obligatorio.", "warning");
                            hdigitaInput.value.focus();
                            return;
                        }
                        break;
                    case 'hacopio':
                        if (recordForm.value.hacopio) {
                            nextField = hrevisaInput.value;
                        } else {
                            showSnackbar("El campo de hora de acopio es obligatorio.", "warning");
                            hacopioInput.value.focus();
                            return;
                        }
                        break;
                    case 'hrevisa':
                        if (recordForm.value.hrevisa) {
                            saveRecord();
                        } else {
                            showSnackbar("El campo de hora de revisión es obligatorio.", "warning");
                            hrevisaInput.value.focus();
                            return;
                        }
                        break;
                }

                if (nextField) {
                    nextField.focus();
                }
            });
        };
        
        const changeLugar = () => {
             showModal.value = true;
             menu.value = false;
        };

        onMounted(() => {
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
                        const userDoc = await getDoc(doc(db, "usuarios", user.uid));
                        if (userDoc.exists()) {
                            const userData = userDoc.data();
                            if (userData.ebaisAutorizados && userData.ebaisAutorizados.length > 0) {
                                const lugaresPromises = userData.ebaisAutorizados.map(async (item) => {
                                    const codigo = typeof item === 'object' ? item.Codigo : item;
                                    const lugarDocRef = doc(db, "lugares_atencion", codigo);
                                    const docSnap = await getDoc(lugarDocRef);
                                    if (docSnap.exists()) {
                                        const data = docSnap.data();
                                        return `${data.codigo} - ${data.nombre}`;
                                    } else {
                                        console.warn(`Documento no encontrado para el EBAIS con código: ${codigo}`);
                                        return null;
                                    }
                                });
                                const lugarDocs = await Promise.all(lugaresPromises);
                                
                                lugares.value = lugarDocs.filter(l => l !== null);
                                
                                if (lugares.value.length === 1) {
                                    selectedLugar.value = lugares.value[0];
                                    await cargarDatosEbais(lugares.value[0].split(" - ")[0]);
                                } else if (lugares.value.length > 1) {
                                    showModal.value = true;
                                } else {
                                     showSnackbar("No se encontraron lugares de atención válidos asignados.", "warning");
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

        const tiempoTotal = computed(() => {
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

        const tipoRecetaIcon = computed(() => {
            if (recordForm.value.tipo === 'CONSULTA') return 'mdi-stethoscope';
            if (recordForm.value.tipo === 'EMERGENCIAS') return 'mdi-hospital-box-outline';
            if (recordForm.value.tipo === 'COPIAS') return 'mdi-content-copy';
            return '';
        });

        return {
            userEmail, lugares, selectedLugar, showModal, seleccionarLugar,
            loading, menu, userAvatar, logout,
            records, registrosFiltrados, headers, recordForm, dialog, addRecord, saveRecord, proceedSave, editRecord,
            confirmDialog, recordToDelete, confirmRemove, removeRecord,
            confirmSaveDialog,
            dateDialog, selectedDate, confirmDate, tipoRecetaOptions,
            isEditMode, consultaCount, emergenciaCount, copiaCount,
            totalRecetasGeneral, promedioRecetasGeneral,
            tipoColor, tipoRecetaIcon,
            filtroMes, filtroAno, meses,
            promedios,
            promedioMesAnterior,
            reporteTrimestral, exportToPDF,
            snackbar, snackbarText, snackbarColor,
            tiempoTotal,
            numRecetaInput, hentraInput, hdigitaInput, hacopioInput, hrevisaInput, saveButton,
            dialogRef,
            focusNextField,
            tiempoPreparacion,
            changeLugar
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
                                ></v-list-item>
                                
                                <v-divider></v-divider>
                                
                                <v-list-item
                                    v-if="lugares.length > 1"
                                    prepend-icon="mdi-hospital-box-outline"
                                    title="Cambiar EBAIS"
                                    @click="changeLugar"
                                ></v-list-item>
                                
                                <v-list-item
                                    prepend-icon="mdi-logout"
                                    title="Cerrar sesión"
                                    @click="logout"
                                ></v-list-item>

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
                <v-row class="mb-4" dense>
                    <v-col cols="12">
                        <v-card class="pa-4 d-flex flex-column" style="background-color: #37474f; border-radius: 12px; color: white;">
                            <div class="d-flex align-center justify-space-between mb-2">
                                <div class="text-h6 font-weight-bold">Total General</div>
                                <v-icon size="36">mdi-chart-line</v-icon>
                            </div>
                            <div class="d-flex justify-space-between align-end mb-1">
                                <div class="text-h4 font-weight-bold">Recetas: {{ totalRecetasGeneral }}</div>
                                <div class="text-h4 font-weight-bold">Promedio: {{ promedioRecetasGeneral }}</div>
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
                        <v-card class="pa-4 d-flex flex-column" style="background-color: #1867c0; border-radius: 12px; color: white;">
                            <div class="d-flex align-center justify-space-between mb-2">
                                <div class="text-subtitle-1 font-weight-bold">CONSULTA</div>
                                <v-icon size="36">mdi-stethoscope</v-icon>
                            </div>
                            <div class="text-h4 font-weight-bold mb-1">Recetas: {{ consultaCount }}</div>
                            <div class="text-body-1">Promedio: {{ promedios.consultaProm }}</div>
                            <v-divider class="my-2" color="white"></v-divider>
                            <div class="text-caption">
                                <div>Promedio mes anterior: {{ promedioMesAnterior.consulta }}</div>
                                <div>Mínimo: {{ promedios.consultaMin }}</div>
                                <div>Máximo: {{ promedios.consultaMax }}</div>
                            </div>
                        </v-card>
                    </v-col>
                    <v-col cols="12" md="4">
                        <v-card class="pa-4 d-flex flex-column" style="background-color: #1697f6; border-radius: 12px; color: white;">
                            <div class="d-flex align-center justify-space-between mb-2">
                                <div class="text-subtitle-1 font-weight-bold">EMERGENCIAS</div>
                                <v-icon size="36">mdi-hospital-box-outline</v-icon>
                            </div>
                            <div class="text-h4 font-weight-bold mb-1">Recetas: {{ emergenciaCount }}</div>
                            <div class="text-body-1">Promedio: {{ promedios.emergenciaProm }}</div>
                            <v-divider class="my-2" color="white"></v-divider>
                            <div class="text-caption">
                                <div>Promedio mes anterior: {{ promedioMesAnterior.emergencia }}</div>
                                <div>Mínimo: {{ promedios.emergenciaMin }}</div>
                                <div>Máximo: {{ promedios.emergenciaMax }}</div>
                            </div>
                        </v-card>
                    </v-col>
                    <v-col cols="12" md="4">
                        <v-card class="pa-4 d-flex flex-column" style="background-color: #7bc6ff; border-radius: 12px; color: black;">
                            <div class="d-flex align-center justify-space-between mb-2">
                                <div class="text-subtitle-1 font-weight-bold">COPIAS</div>
                                <v-icon size="36">mdi-content-copy</v-icon>
                            </div>
                            <div class="text-h4 font-weight-bold mb-1">Recetas: {{ copiaCount }}</div>
                            <div class="text-body-1">Promedio: {{ promedios.copiaProm }}</div>
                            <v-divider class="my-2" color="black"></v-divider>
                            <div class="text-caption">
                                <div>Promedio mes anterior: {{ promedioMesAnterior.copia }}</div>
                                <div>Mínimo: {{ promedios.copiaMin }}</div>
                                <div>Máximo: {{ promedios.copiaMax }}</div>
                            </div>
                        </v-card>
                    </v-col>
                </v-row>

                <v-dialog v-model="showModal" max-width="400" persistent>
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
                                            ref="numRecetaInput"
                                            label="Número de Receta"
                                            type="number"
                                            :disabled="isEditMode"
                                            required
                                            @keydown.enter="focusNextField('num')"
                                        ></v-text-field>
                                    </v-col>
                                </v-row>
                                <v-row dense>
                                    <v-col cols="12" md="6">
                                        <v-text-field 
                                            v-model="recordForm.hentra"
                                            ref="hentraInput"
                                            label="Hora de Entrada"
                                            type="time"
                                            required
                                            @keydown.enter="focusNextField('hentra')"
                                        ></v-text-field>
                                    </v-col>
                                    <v-col cols="12" md="6">
                                        <v-text-field 
                                            v-model="recordForm.hdigita"
                                            ref="hdigitaInput"
                                            label="Hora de Digitación"
                                            type="time"
                                            required
                                            @keydown.enter="focusNextField('hdigita')"
                                        ></v-text-field>
                                    </v-col>
                                </v-row>
                                <v-row dense>
                                    <v-col cols="12" md="6">
                                        <v-text-field 
                                            v-model="recordForm.hacopio"
                                            ref="hacopioInput"
                                            label="Hora de Acopio"
                                            type="time"
                                            required
                                            @keydown.enter="focusNextField('hacopio')"
                                        ></v-text-field>
                                    </v-col>
                                    <v-col cols="12" md="6">
                                        <v-text-field 
                                            v-model="recordForm.hrevisa"
                                            ref="hrevisaInput"
                                            label="Hora de Revisión"
                                            type="time"
                                            required
                                            @keydown.enter="focusNextField('hrevisa')"
                                        ></v-text-field>
                                    </v-col>
                                </v-row>
                            </v-container>
                        </v-card-text>
                        <v-card-actions>
                            <v-spacer></v-spacer>
                            <v-btn color="grey" @click="dialog = false">Cancelar</v-btn>
                            <v-btn color="primary" ref="saveButton" @click="saveRecord">Guardar</v-btn>
                        </v-card-actions>
                    </v-card>
                </v-dialog>

                <v-dialog v-model="confirmSaveDialog" max-width="500">
                    <v-card class="py-4">
                        <v-card-title class="d-flex align-center justify-center text-blue-darken-2 pb-4">
                            <v-icon icon="mdi-check-circle" size="30" class="me-2"></v-icon>
                            Confirmar Registro
                        </v-card-title>
                        <v-card-text class="text-center">
                            <v-icon :icon="tipoRecetaIcon" size="80" class="text-blue-darken-3 mb-2"></v-icon>
                            <p class="text-h5 text-uppercase font-weight-bold text-blue-darken-3 mb-4">{{ recordForm.tipo }}</p>
                            
                            <p class="text-h6 text-center">Tiempo de preparación:</p>
                            <p class="text-h3 text-center text-blue-darken-3 font-weight-bold mb-4">{{ tiempoPreparacion }}</p>
                            <v-divider class="my-4"></v-divider>
                            <p class="text-body-1 text-center">¿Estás seguro de que deseas guardar este registro?</p>
                        </v-card-text>
                        <v-card-actions>
                            <v-spacer></v-spacer>
                            <v-btn color="grey-darken-1" @click="confirmSaveDialog = false">CANCELAR</v-btn>
                            <v-btn color="blue-darken-2" @click="proceedSave">GUARDAR</v-btn>
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
