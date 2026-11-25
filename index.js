// ==============================
// RESUMEN PROFESIONAL
// ==============================
var summaryMap;
var departmentLayer;
var departamentosExperiencia = [];
var selectedDepartment = '';

function initializeMapSummary() {
    document.querySelector('.about-me').insertAdjacentHTML('beforeend', information.summary[0]);

    departamentosExperiencia = Array.from(new Set(information.experience.map(function(experience) {
        return experience.department;
    }).filter(Boolean)));

    summaryMap = L.map(
        'map-summary',
        {
            dragging: false,
            scrollWheelZoom: false,
            zoomControl: false,
            doubleClickZoom: false,
            keyboard: false,
            touchZoom: false,
            boxZoom: false,
            zoomSnap: 0.1,
            zoomDelta: 0.2
        }
    );

    departmentLayer = L.geoJSON(
        geojsonDepartamentos,
        {
            style: getDefaultStyle,
            onEachFeature: function(feature, layer) {
                var department = feature.properties.nombdep;
                layer.bindTooltip(department, { sticky: true });
                layer.on('click', function() {
                    setSelectedDepartment(selectedDepartment === department ? '' : department);
                });
                layer.on('mouseover', function() {
                    if (selectedDepartment !== department) {
                        this.setStyle({ weight: 2.5 });
                    }
                });
                layer.on('mouseout', function() {
                    this.setStyle(getDefaultStyle(feature));
                });
            }
        }
    ).addTo(summaryMap);

    requestAnimationFrame(fitSummaryMap);
};

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, function(character) {
        return {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[character];
    });
}

function formatEducationDate(date) {
    if (!date) {
        return '';
    }

    return new Intl.DateTimeFormat('es-PE', {
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC'
    }).format(new Date(date + 'T00:00:00'));
}

function formatExperienceDate(date) {
    return date ? formatEducationDate(date) : '';
}

function calculateExperienceYears(experiences, asOfDate) {
    var today = asOfDate || new Date();
    var todayUTC = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    var dayInMilliseconds = 24 * 60 * 60 * 1000;
    var periods = experiences.map(function(experience) {
        var start = Date.parse(experience.start + 'T00:00:00Z');
        var end = Date.parse((experience.end || new Date(todayUTC).toISOString().slice(0, 10)) + 'T00:00:00Z');

        if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
            throw new Error('Invalid date range in professional experience: ' + experience.company);
        }

        return {
            start: start,
            end: Math.min(end, todayUTC)
        };
    }).filter(function(period) {
        return period.start <= todayUTC;
    }).sort(function(first, second) {
        return first.start - second.start;
    });

    var mergedPeriods = [];
    periods.forEach(function(period) {
        var previousPeriod = mergedPeriods[mergedPeriods.length - 1];
        if (previousPeriod && period.start <= previousPeriod.end + dayInMilliseconds) {
            previousPeriod.end = Math.max(previousPeriod.end, period.end);
        } else {
            mergedPeriods.push({ start: period.start, end: period.end });
        }
    });

    var totalDays = mergedPeriods.reduce(function(days, period) {
        return days + Math.floor((period.end - period.start) / dayInMilliseconds) + 1;
    }, 0);

    return Math.floor(totalDays / 365.2425);
}

function renderProfileHighlights() {
    var experienceYears = calculateExperienceYears(information.experience);
    var experienceCount = information.experience.length;
    var yearsLabel = document.querySelector('#experience-years');
    var periodNote = document.querySelector('#experience-period-note');
    var expertiseList = document.querySelector('.expertise-list');

    yearsLabel.textContent = experienceYears + '+';
    periodNote.textContent = experienceCount + ' experiencias · periodos simultáneos contados una sola vez';
    expertiseList.innerHTML = information.competencies.technical.map(function(competency) {
        return `<span class="expertise-chip">${escapeHTML(competency.category)}</span>`;
    }).join('');
}

function normalizeSearch(value) {
    return value
        .toLocaleLowerCase('es')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

function getList(value) {
    if (Array.isArray(value)) {
        return value.filter(Boolean);
    }

    return value ? [value] : [];
}

function getExperienceLocation(experience) {
    return [
        experience.department,
        getList(experience.province).join(', ')
    ].filter(Boolean).join(' · ');
}

function initializeExperienceDashboard() {
    var sectorSelect = document.querySelector('#experience-sector');
    var departmentSelect = document.querySelector('#experience-department');
    var searchInput = document.querySelector('#experience-search');
    var clearButton = document.querySelector('#clear-experience-filters');
    var sectors = Array.from(new Set(information.experience.map(function(experience) {
        return experience.sect;
    }).filter(Boolean))).sort();
    var departments = Array.from(new Set(information.experience.map(function(experience) {
        return experience.department;
    }).filter(Boolean))).sort();

    sectors.forEach(function(sector) {
        var option = document.createElement('option');
        option.value = sector;
        option.textContent = sector;
        sectorSelect.appendChild(option);
    });

    departments.forEach(function(department) {
        var option = document.createElement('option');
        option.value = department;
        option.textContent = department;
        departmentSelect.appendChild(option);
    });

    searchInput.addEventListener('input', renderExperienceDashboard);
    sectorSelect.addEventListener('change', renderExperienceDashboard);
    departmentSelect.addEventListener('change', function() {
        setSelectedDepartment(departmentSelect.value);
    });
    clearButton.addEventListener('click', function() {
        searchInput.value = '';
        sectorSelect.value = '';
        setSelectedDepartment('');
        searchInput.focus();
    });

    document.querySelector('#experience-results').addEventListener('click', function(event) {
        var trigger = event.target.closest('.dashboard-result-toggle');
        if (!trigger) {
            return;
        }

        var expanded = trigger.getAttribute('aria-expanded') === 'true';
        trigger.setAttribute('aria-expanded', String(!expanded));
        document.querySelector('#' + trigger.getAttribute('aria-controls')).hidden = expanded;
    });

    renderExperienceDashboard();
}

function renderExperienceDashboard() {
    var query = normalizeSearch(document.querySelector('#experience-search').value)
        .trim()
        .split(/\s+/)
        .filter(Boolean);
    var selectedSector = document.querySelector('#experience-sector').value;
    var selectedArea = document.querySelector('#experience-department').value;
    var results = information.experience
        .filter(function(experience) {
            var searchableText = normalizeSearch([
                experience.job,
                experience.company,
                experience.level,
                experience.sect,
                experience.department,
                getList(experience.province).join(' '),
                experience.summary,
                experience.mode,
                getList(experience.skills).join(' '),
                experience.end ? '' : 'actualidad'
            ].join(' '));
            return (!selectedSector || experience.sect === selectedSector)
                && (!selectedArea || experience.department === selectedArea)
                && query.every(function(term) {
                    return searchableText.includes(term);
                });
        })
        .sort(function(first, second) {
            return new Date(second.start) - new Date(first.start);
        });
    var resultsContainer = document.querySelector('#experience-results');

    document.querySelector('#experience-result-count').textContent =
        results.length + (results.length === 1 ? ' experiencia encontrada' : ' experiencias encontradas');

    if (results.length === 0) {
        resultsContainer.innerHTML = '<p class="empty-results">No hay experiencias que coincidan. Prueba otro término o limpia los filtros.</p>';
        return;
    }

    resultsContainer.innerHTML = results.map(function(experience, index) {
        var detailId = 'experience-detail-' + index;
        var location = getExperienceLocation(experience) || 'Ubicación no especificada';
        var skills = getList(experience.skills).map(function(skill) {
            return `<span class="skill-chip">${escapeHTML(skill)}</span>`;
        }).join('');

        return `
            <article class="dashboard-result">
                <button class="dashboard-result-toggle" type="button" aria-expanded="false" aria-controls="${detailId}">
                    <span class="result-company">${escapeHTML(experience.company)}</span>
                    <span class="result-job">${escapeHTML(experience.job)}</span>
                    <span class="result-meta">${formatEducationDate(experience.start)} — ${formatExperienceDate(experience.end) || 'Actualidad'} · ${escapeHTML(location)}</span>
                    <span class="result-prompt">Ver detalles <span aria-hidden="true">+</span></span>
                </button>
                <div class="dashboard-result-details" id="${detailId}" hidden>
                    <p>${escapeHTML(experience.summary || '')}</p>
                    <div class="detail-chips">
                        ${[experience.sect, experience.mode].filter(Boolean).map(function(value) {
                            return `<span class="detail-chip">${escapeHTML(value)}</span>`;
                        }).join('')}
                    </div>
                    <div class="skill-chips">${skills}</div>
                </div>
            </article>
        `;
    }).join('');
}

function setSelectedDepartment(department) {
    selectedDepartment = department;
    document.querySelector('#experience-department').value = department;

    if (departmentLayer) {
        departmentLayer.eachLayer(function(layer) {
            layer.setStyle(getDefaultStyle(layer.feature));
        });
    }

    renderExperienceDashboard();
}

function buildJourneyEntries() {
    var entries = [];
    var educationData = information.education[0];

    educationData.school_education.forEach(function(study) {
        entries.push({
            type: 'education',
            start: study.start,
            end: study.end,
            title: study.level,
            organization: study.institution,
            description: 'Formación escolar finalizada.',
            tags: [study.state]
        });
    });

    educationData.higher_education.forEach(function(studies) {
        var undergraduate = studies.undergraduated;
        var postgraduate = studies.postgraduated;

        entries.push({
            type: 'education',
            start: undergraduate.start,
            end: undergraduate.bachelor || undergraduate.end,
            title: undergraduate.career,
            organization: undergraduate.university,
            description: undergraduate.thesys
                ? 'Formación universitaria y trabajo de investigación: ' + undergraduate.thesys + '.'
                : 'Formación universitaria en ' + undergraduate.career + '.',
            tags: [undergraduate.bachelor ? 'Grado de bachiller' : '', undergraduate.state].filter(Boolean)
        });

        if (undergraduate.title) {
            entries.push({
                type: 'education',
                start: undergraduate.title,
                title: 'Obtención del título profesional',
                organization: undergraduate.university,
                description: 'Título profesional de ' + undergraduate.career + '.',
                tags: ['Ingeniería Geográfica']
            });
        }

        entries.push({
            type: 'education',
            start: postgraduate.start,
            title: postgraduate.level + ' · ' + postgraduate.specialization,
            organization: postgraduate.university,
            description: postgraduate.state,
            planned: !postgraduate.start,
            tags: ['Próximo paso']
        });
    });

    information.experience.forEach(function(experience) {
        entries.push({
            type: 'experience',
            start: experience.start,
            end: experience.end,
            title: experience.job,
            organization: experience.company,
            description: experience.summary,
            tags: [experience.sect, experience.department].filter(Boolean)
                .concat(getList(experience.skills).slice(0, 4)),
            extraSkillCount: Math.max(getList(experience.skills).length - 4, 0)
        });
    });

    var currentDate = Date.now();
    return entries.sort(function(first, second) {
        var firstDate = getJourneySortDate(first, currentDate);
        var secondDate = getJourneySortDate(second, currentDate);
        return secondDate - firstDate;
    });
}

function getJourneySortDate(entry, currentDate) {
    if (entry.planned) {
        return -Infinity;
    }

    if (entry.type === 'experience') {
        var startTimestamp = entry.start ? Date.parse(entry.start + 'T00:00:00Z') : -Infinity;
        if (!Number.isFinite(startTimestamp)) {
            return -Infinity;
        }

        return entry.end ? startTimestamp : Math.max(currentDate, startTimestamp);
    }

    var date = entry.end || entry.start;
    var timestamp = date ? Date.parse(date + 'T00:00:00Z') : -Infinity;
    return Number.isFinite(timestamp) ? timestamp : -Infinity;
}

function renderJourneyTimeline() {
    var timeline = document.querySelector('.journey-timeline');
    timeline.innerHTML = buildJourneyEntries().map(function(entry) {
        var dateLabel;
        if (entry.planned) {
            dateLabel = 'Próximo paso · En planificación';
        } else if (entry.start && entry.end) {
            dateLabel = formatEducationDate(entry.start) + ' — ' + formatEducationDate(entry.end);
        } else if (entry.end) {
            dateLabel = formatEducationDate(entry.end);
        } else {
            dateLabel = formatEducationDate(entry.start) + (entry.type === 'experience' ? ' — Actualidad' : '');
        }

        var tags = (entry.tags || []).map(function(tag) {
            return `<span class="timeline-tag">${escapeHTML(tag)}</span>`;
        });
        if (entry.extraSkillCount) {
            tags.push(`<span class="timeline-tag">+${entry.extraSkillCount} habilidades</span>`);
        }

        return `
            <li class="timeline-event timeline-event-${entry.type}" data-timeline-type="${entry.type}">
                <article class="timeline-card">
                    <span class="timeline-date">${escapeHTML(dateLabel)}</span>
                    <span class="timeline-type">${entry.type === 'education' ? 'Educación' : 'Experiencia'}</span>
                    <h3>${escapeHTML(entry.title)}</h3>
                    <p class="timeline-organization">${escapeHTML(entry.organization)}</p>
                    <p class="timeline-description">${escapeHTML(entry.description || '')}</p>
                    <div class="timeline-tags">${tags.join('')}</div>
                </article>
            </li>
        `;
    }).join('');
}

function initializeTimelineFilters() {
    var filterButtons = document.querySelectorAll('[data-timeline-filter]');
    filterButtons.forEach(function(button) {
        button.addEventListener('click', function() {
            var filter = button.getAttribute('data-timeline-filter');
            filterButtons.forEach(function(filterButton) {
                filterButton.setAttribute('aria-pressed', String(filterButton === button));
            });
            document.querySelectorAll('.timeline-event').forEach(function(event) {
                event.hidden = filter !== 'all' && event.getAttribute('data-timeline-type') !== filter;
            });
        });
    });
}

// ==============================
// FUNCIONES AUXILIARES
// ==============================
function changeSectionView(buttonIDSelected, sectionIDSelected) {
    // Activamos y desactivamos los botones
    const buttons = document.querySelectorAll('.footer button');
    buttons.forEach(btn => {
        if (btn.id === buttonIDSelected) {
            btn.setAttribute('state', 'activated');
            btn.setAttribute('aria-pressed', 'true');
        } else {
            btn.setAttribute('state', 'deactivated');
            btn.setAttribute('aria-pressed', 'false');
        }
    });
    // Activamos y desactivamos las secciones
    const sections = document.querySelectorAll('main .section');
    sections.forEach(sect => {
        if (sect.id === sectionIDSelected) {
            sect.setAttribute('state', 'activated');
            sect.setAttribute('aria-hidden', 'false');
            sect.scrollTop = 0;
        } else {
            sect.setAttribute('state', 'deactivated');
            sect.setAttribute('aria-hidden', 'true');
        }
    });
    if (sectionIDSelected === 'sec-summary' && summaryMap) {
        requestAnimationFrame(fitSummaryMap);
    }
}

function fitSummaryMap() {
    if (!summaryMap || !departmentLayer) {
        return;
    }

    summaryMap.invalidateSize({ pan: false });
    summaryMap.fitBounds(departmentLayer.getBounds(), {
        padding: [18, 18],
        maxZoom: 5,
        animate: false
    });
}

function getDefaultStyle(feature) {
    var nombre = feature.properties.nombdep;
    var tieneExperiencia = departamentosExperiencia.includes(nombre);
    var isSelected = selectedDepartment === nombre;
    
    return {
        color: isSelected ? '#D6A84F' : '#102A43',
        weight: isSelected ? 3 : 1,
        fillColor: tieneExperiencia ? '#176B87' : '#DCE7ED',
        fillOpacity: tieneExperiencia ? 0.82 : 0.55
    };
}

// ==============================
// INICIALIZACION DEL SISTEMA
// ==============================
document.addEventListener('DOMContentLoaded', () => {
    initializeMapSummary();
    renderProfileHighlights();
    initializeExperienceDashboard();
    renderJourneyTimeline();
    initializeTimelineFilters();
    window.addEventListener('resize', function() {
        requestAnimationFrame(fitSummaryMap);
    });

    const buttons = document.querySelectorAll('.footer button');
    changeSectionView('btn-summary', 'sec-summary');
    buttons.forEach(button => {
        button.addEventListener('click', () => {
            const sectionID = button.id.replace('btn', 'sec');
            changeSectionView(button.id, sectionID)
        });
    });
});