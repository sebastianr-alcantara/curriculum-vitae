// ==============================
// RESUMEN PROFESIONAL
// ==============================
var summaryMap;
var provinceSummaryMap = null;
var featureSelected = null;
var summaryModalControl = null;
var departamentosExperiencia = [];

function initializeMapSummary() {
    // Creamos el mapa
    summaryMap = L.map(
        'map-summary', 
        {
            center: [-9.19, -75.0152],
            zoomSnap: 0.1,
            zoomDelta: 0.1,
            dragging: false,
            scrollWheelZoom: false,
            zoomControl: false,
            doubleClickZoom: false
        }
    );

    // Inicializamos el modal antes de usarlo
    summaryModalControl = initializeSummaryModal();

    // Asignamos mi resumen profesional
    var acercaDeMiContenedor = document.querySelector('.about-me'); 
    var acercaDeMiTexto = information.summary[0];

    acercaDeMiContenedor.insertAdjacentHTML('beforeend', acercaDeMiTexto);

    // Determinamos los departamentos con experiencia
    information.experience.forEach(
        function(experiencia) {
            if (!departamentosExperiencia.includes(experiencia.department)) {
                departamentosExperiencia.push(experiencia.department)
            }
        }
    );

    // Cargamos el Layer por defecto
    var departamentosLayer = L.geoJSON(
        geojsonDepartamentos,
        {
            style: function(feature) {
                var nombreDepartamentoGeojson = feature.properties.nombdep; // Obtenemos el nombre del departamento
                var verificarNombreDepartamento = departamentosExperiencia.includes(nombreDepartamentoGeojson) // Verificamos el nombre del departamento
                return {
                    color: 'var(--colour-primary-ultradark)',
                    weight: 1,
                    fillColor: verificarNombreDepartamento ? 'var(--colour-primary-dark)' : 'var(--colour-primary-ultralight)', // Oscuro cuando hay experiencia
                    fillOpacity: verificarNombreDepartamento ? 0.7 : 0.2
                }
            },
            onEachFeature: function(feature, layer) {
                // Verificamos si el departamento tiene experiencia relacionada
                var nombreDepartamento = feature.properties.nombdep;
                var haveExperience = departamentosExperiencia.includes(nombreDepartamento);
                // Efecto seleccionado
                layer.on(
                    'click',
                    function() {
                        // Ignoramos si no hay experiencia
                        if (!haveExperience) {
                            return
                        }
                        // Buscamos todas las provincias con experiencia
                        var provinciasExperiencia = [];
                        information.experience.forEach(
                                function(experiencia) {
                                    if (experiencia.department === nombreDepartamento) {
                                        experiencia.province.forEach(
                                            function(provincia) {
                                                if (!provinciasExperiencia.includes(provincia)) {
                                                    provinciasExperiencia.push(provincia);
                                                }
                                            }
                                        );
                                    }
                                }
                        );
                        // Si el feature ya se encuentra seleccionado, lo deseleccionamos
                        if (featureSelected === this) {
                            var defaultStyleFeature = getDefaultStyle(feature);
                            this.setStyle(defaultStyleFeature);
                            featureSelected = null;
                            summaryModalControl.hide();
                        } else {
                            // Si el feature no esta seleccionado, lo seleccionamos
                            if (featureSelected) {
                                var defaultStyleFeature = getDefaultStyle(featureSelected.feature);
                                featureSelected.setStyle(defaultStyleFeature);
                            } 
                            this.setStyle({
                                weight: 4
                            });

                            featureSelected = this
                            summaryModalControl.show(nombreDepartamento, provinciasExperiencia, feature)
                        }
                    }
                );
                // Efecto Hover solo para los departamentos con experiencia
                if (haveExperience) {
                    layer.on(
                        'mouseover',
                        function() {
                            if (featureSelected != this) {
                                this.setStyle({
                                    weight: 4
                                });
                            }    
                        }
                    );
                    layer.on(
                        'mouseout',
                        function() {
                            if (featureSelected != this) {
                                var defaultStyleFeature = getDefaultStyle(feature);
                                this.setStyle(defaultStyleFeature);
                            }
                        }
                    );
                }

            }
        }
    ).addTo(summaryMap);
    
    summaryMap.fitBounds(departamentosLayer.getBounds());
};

function initializeSummaryModal() {
    // Seleccionamos los elementos del modal que son configurables
    var summaryModalContainer = document.querySelector('.summary-modal');
    var summaryModalBody = summaryModalContainer.querySelector('.modal-body');
    var closeSummaryModalButton = summaryModalContainer.querySelector('#icon-close-header-summary-modal');

    // Funcion para mostrar el modal
    function showSummaryModal(departamento, provincias, feature) {
        summaryModalContainer.style.display = 'flex';
        
        // Mostramos todas las provincias con experiencia
        summaryModalBody.innerHTML = '';

        summaryModalBody.innerHTML += `
            <div class="place-work">
                <strong>Departamento:&nbsp;</strong>${departamento}
            </div>
            <div class="place-work">
                <strong>Provincia:&nbsp;</strong>${provincias.join(', ')}
            </div>
            <div id="province-map-summary" class="geovisor"></div>
            <div class="experience-in-department"></div>
        `;

        // Creamos el mapa provincial
        provinceSummaryMap = L.map(
            'province-map-summary', 
            {
                center: [-9.19, -75.0152],
                zoomSnap: 0.4,
                zoomDelta: 0.4,
                dragging: false,
                scrollWheelZoom: false,
                zoomControl: false,
                doubleClickZoom: false
            }
        );

        provinceSummaryMap.eachLayer(function(layer) {
            provinceSummaryMap.removeLayer(layer);
        });

        // Agregamos el departamento seleccionado
        var departamentSelectedLayer = L.geoJSON(
            feature,
            {
                style: {
                    color: 'var(--colour-primary-ultradark)',
                    weight: 2,
                    fillColor: 'transparent',
                    fillOpacity: 0
                }
            }
        ).addTo(provinceSummaryMap);

        // Filtramos las provincias seleccionadas
        var provincesByDepartmentSelected = {
            type: 'FeatureCollection',
            features: geojsonProvincias.features.filter(
                function(provincia) {
                    return provincia.properties.nombdep === departamento;
                }
            )
        };

        // Agregamos las provincias del departamento
        var provincesSelectedLayer = L.geoJSON(
            provincesByDepartmentSelected,
            {
                style: function(feature) {
                    var nombreProvinciaGeojson = feature.properties.nombprov;
                    var verificarNombreProvincia = provincias.includes(nombreProvinciaGeojson);

                    return {
                        color: 'var(--colour-primary-ultradark)',
                        weight: 1, 
                        fillColor: verificarNombreProvincia ? 'var(--colour-primary-dark)' : 'var(--colour-primary-ultralight)',
                        fillOpacity: verificarNombreProvincia ? 0.7 : 0.2
                    };
                },
            }
        )
        
        provincesSelectedLayer.addTo(provinceSummaryMap);

        // Ajustamos el mapa al departamento seleccionado
        provinceSummaryMap.fitBounds(
            provincesSelectedLayer.getBounds()
        );

        summaryMap.invalidateSize();

        // Listamos la experiencia por departamento
        var departmentExperience = information.experience.filter(
            function (experiencia) {
                return experiencia.department === departamento
            }
        );

        var departmentExperienceContainer = document.querySelector('.experience-in-department');

        departmentExperienceContainer.innerHTML = departmentExperience.map(
            function (experience) {
                return `
                    <div class='single-experience'>
                        <div class='header-experience'>
                            <div class='company'>${experience.company}</div>
                            <div class='date'>
                                <span>${experience.start.split('-')[1]}/${experience.start.split('-')[0]}</span>
                                <span>-</span>
                                <span>${experience.end.split('-')[1]}/${experience.end.split('-')[0]}</span>
                            </div>
                        </div>
                        <div class='summary-experience'>${experience.summary}</div>
                    </div>
                `;
            }
        ).join('');
    }

    // Funcion para ocultar el modal
    function hideSummaryModal() {

        // Ocultamos el modal
        summaryModalContainer.style.display = 'none';

        // Restauramos el estilo del departamento seleccionado
        if (featureSelected) {
            featureSelected.setStyle(
                getDefaultStyle(featureSelected.feature)
            );

            featureSelected = null;
        }

        // Eliminamos el mapa provincial
        if (provinceSummaryMap) {
            provinceSummaryMap.remove();
            provinceSummaryMap = null;
        }

        // Actualizamos el tamaño del mapa principal
        setTimeout(function() {
            if (summaryMap) {
                summaryMap.invalidateSize();
            }
        }, 100);
    }

    closeSummaryModalButton.addEventListener('click', function () {
        hideSummaryModal();
    });

    // Retornamos las funciones
    return {
        show: showSummaryModal,
        hide: hideSummaryModal
    };
}

// ==============================
// EDUCACIÓN PROFESIONAL
// ==============================

// ==============================
// EXPERIENCIA PROFESIONAL
// ==============================

// ==============================
// FUNCIONES AUXILIARES
// ==============================
function changeSectionView(buttonIDSelected, sectionIDSelected) {
    // Activamos y desactivamos los botones
    const buttons = document.querySelectorAll('footer button');
    buttons.forEach(btn => {
        if (btn.id === buttonIDSelected) {
            btn.setAttribute('state', 'activated');
        } else {
            btn.setAttribute('state', 'deactivated');
        }
    });
    // Activamos y desactivamos las secciones
    const sections = document.querySelectorAll('main .section');
    sections.forEach(sect => {
        if (sect.id === sectionIDSelected) {
            sect.setAttribute('state', 'activated');
        } else {
            sect.setAttribute('state', 'deactivated');
        }
    });
    // Refrescamos el mapa cuando se vuelve a resumen
    if (sectionIDSelected === 'sec-summary' && summaryMap) {
        setTimeout(
            function() {
                summaryMap.invalidateSize()
            },
            100
        );
    }
}

function getDefaultStyle(feature) {
    var nombre = feature.properties.nombdep;
    var tieneExperiencia = departamentosExperiencia.includes(nombre);
    
    return {
        color: 'var(--colour-primary-ultradark)',
        weight: 1,
        fillColor: tieneExperiencia ? 'var(--colour-primary-dark)' : 'var(--colour-primary-ultralight)',
        fillOpacity: tieneExperiencia ? 0.7 : 0.2
    };
}

// ==============================
// INICIALIZACION DEL SISTEMA
// ==============================
document.addEventListener('DOMContentLoaded', () => {
    // Resumen Profesional
    initializeMapSummary();

    // Cambio de Seccion
    const buttons = document.querySelectorAll('footer button');
    changeSectionView('btn-summary', 'sec-summary');
    buttons.forEach(button => {
        button.addEventListener('click', () => {
            const sectionID = button.id.replace('btn', 'sec');
            changeSectionView(button.id, sectionID)
        });
    });
});