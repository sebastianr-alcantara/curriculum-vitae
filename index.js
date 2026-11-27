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

function calculateExperienceDays(experiences, asOfDate) {
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

    return mergedPeriods.reduce(function(days, period) {
        return days + Math.floor((period.end - period.start) / dayInMilliseconds) + 1;
    }, 0);
}

function calculateExperienceYears(experiences, asOfDate) {
    return Math.floor(calculateExperienceDays(experiences, asOfDate) / 365.2425);
}

function formatExperienceDuration(days) {
    if (!days) {
        return 'Sin experiencia';
    }

    var totalMonths = Math.round(days * 12 / 365.2425);
    if (!totalMonths) {
        return 'Menos de 1 mes';
    }

    var years = Math.floor(totalMonths / 12);
    var months = totalMonths % 12;
    return [
        years ? years + (years === 1 ? ' año' : ' años') : '',
        months ? months + (months === 1 ? ' mes' : ' meses') : ''
    ].filter(Boolean).join(' y ');
}

function renderProfileHighlights() {
    var today = new Date();
    var experienceYears = calculateExperienceYears(information.experience, today);
    var yearsLabel = document.querySelector('#experience-years');
    information.experience.forEach(function(experience) {
        if (experience.institution_type !== 'public' && experience.institution_type !== 'private') {
            throw new Error('Invalid institution type in professional experience: ' + experience.company);
        }
    });

    yearsLabel.textContent = experienceYears + '+';
    ['public', 'private'].forEach(function(type) {
        var experiences = information.experience.filter(function(experience) {
            return experience.institution_type === type;
        });
        document.querySelector('#' + type + '-experience-duration').textContent =
            formatExperienceDuration(calculateExperienceDays(experiences, today));
    });
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
            level: study.level,
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
            end: undergraduate.end,
            title: undergraduate.career,
            career: undergraduate.career,
            level: undergraduate.level,
            organization: undergraduate.university,
            description: 'Formación universitaria en ' + undergraduate.career + '.',
            tags: [undergraduate.state].filter(Boolean)
        });

        if (undergraduate.bachelor) {
            entries.push({
                type: 'education',
                milestone: true,
                start: undergraduate.bachelor,
                title: 'Grado de bachiller',
                organization: undergraduate.university,
                description: 'Grado de bachiller en ' + undergraduate.career + '.',
                tags: []
            });
        }

        if (undergraduate.title) {
            entries.push({
                type: 'education',
                milestone: true,
                start: undergraduate.title,
                title: 'Título profesional',
                organization: undergraduate.university,
                description: 'Título profesional de ' + undergraduate.career + '.'
                    + (undergraduate.thesys ? ' Tesis: ' + undergraduate.thesys + '.' : ''),
                tags: ['Ingeniería Geográfica']
            });
        }

        entries.push({
            type: 'education',
            start: postgraduate.start,
            title: postgraduate.level + ' · ' + postgraduate.specialization,
            career: postgraduate.specialization,
            level: postgraduate.level,
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
            institutionType: experience.institution_type,
            sector: experience.sect,
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

var journeyResizeObserver;

function getJourneySectorIcon(sector) {
    var icons = {
        'Áreas Naturales Protegidas': 'park',
        'Drenaje Pluvial': 'rainy',
        'Telecomunicaciones': 'cell_tower',
        'Saneamiento de Agua y Desagüe': 'water_drop',
        'Inmobiliario': 'apartment'
    };
    return icons[sector] || 'work';
}

function getJourneyDuration(start, end) {
    var startDate = new Date(start);
    var endDate = new Date(end);
    var months = (endDate.getUTCFullYear() - startDate.getUTCFullYear()) * 12
        + endDate.getUTCMonth() - startDate.getUTCMonth();

    function dateAfterMonths(count) {
        var firstDay = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth() + count, 1));
        var lastDay = new Date(Date.UTC(firstDay.getUTCFullYear(), firstDay.getUTCMonth() + 1, 0)).getUTCDate();
        return Date.UTC(firstDay.getUTCFullYear(), firstDay.getUTCMonth(), Math.min(startDate.getUTCDate(), lastDay));
    }

    if (dateAfterMonths(months) > end) {
        months--;
    }
    var years = Math.floor(months / 12);
    var remainingMonths = months % 12;
    var days = Math.round((end - dateAfterMonths(months)) / (24 * 60 * 60 * 1000));
    var parts = [];
    if (years) {
        parts.push({ value: years, unit: years === 1 ? 'año' : 'años', short: 'a' });
    }
    if (remainingMonths) {
        parts.push({ value: remainingMonths, unit: remainingMonths === 1 ? 'mes' : 'meses', short: 'm' });
    }
    if (days || !parts.length) {
        parts.push({ value: days, unit: days === 1 ? 'día' : 'días', short: 'd' });
    }
    return {
        full: parts.map(function(part) { return part.value + ' ' + part.unit; }).join(' '),
        compact: parts.map(function(part) { return part.value + part.short; }).join(' '),
        shortest: parts[0].value + parts[0].short + (parts.length > 1 ? '+' : '')
    };
}

function fitJourneyText(context, element, text) {
    var width = element.clientWidth;
    if (!width) {
        return;
    }
    context.font = getComputedStyle(element).font;
    var words = text.split(/\s+/);
    var label = '';
    words.some(function(word) {
        var next = label ? label + ' ' + word : word;
        if (context.measureText(next).width > width) {
            return true;
        }
        label = next;
        return false;
    });
    var initials = words.map(function(word) {
        return /^[\p{L}\p{N}]/u.test(word) ? word.charAt(0).toLocaleUpperCase('es') : '';
    }).join('');
    if (!label) {
        label = context.measureText(initials).width <= width ? initials : '';
    }
    element.textContent = label || '…';
}

function fitJourneyCardLabels(list, entries) {
    var canvas = document.createElement('canvas');
    var context = canvas.getContext('2d');
    list.querySelectorAll('.timeline-card').forEach(function(button) {
        var item = entries[Number(button.getAttribute('data-journey-index'))];
        var primary = button.querySelector('.timeline-card-label');
        var institution = button.querySelector('.timeline-card-institution');
        var meta = button.querySelector('.timeline-card-meta');
        var dates = button.querySelector('.timeline-card-dates');
        var metaWidth = meta.clientWidth;
        if (!metaWidth) {
            return;
        }

        var primaryText = item.entry.type === 'experience' || item.entry.milestone
            ? item.entry.title : item.entry.career || item.entry.level;
        context.font = getComputedStyle(meta).font;
        var date = item.entry.milestone ? item.entry.start : item.entry.end;
        var labels = item.entry.type === 'experience'
            ? [item.duration.full, item.duration.compact, item.duration.shortest]
            : item.entry.career && item.entry.end
                ? [formatJourneyDateLabel(item.entry), item.entry.start.slice(0, 4) + ' — ' + item.entry.end.slice(0, 4)]
                : date ? [formatEducationDate(date), date.slice(0, 4)] : ['En curso'];
        meta.textContent = institution && !button.closest('.timeline-event-compact') && item.entry.career && item.entry.end
            ? labels[0]
            : labels.find(function(text) {
                return context.measureText(text).width <= metaWidth;
            }) || '…';
        if (dates && dates.clientWidth) {
            var startDate = dates.querySelector('.timeline-card-start');
            var endDate = dates.querySelector('.timeline-card-end');
            context.font = getComputedStyle(startDate).font;
            var startLabels = [formatJourneyExperienceDate(item.entry.start), formatJourneyExperienceDate(item.entry.start, true)];
            var endLabels = item.entry.end
                ? [formatJourneyExperienceDate(item.entry.end), formatJourneyExperienceDate(item.entry.end, true)]
                : ['Actualidad'];
            startDate.textContent = startLabels.find(function(text) {
                return context.measureText(text).width <= dates.clientWidth;
            }) || item.entry.start.slice(0, 4);
            endDate.textContent = endLabels.find(function(text) {
                return context.measureText(text).width <= dates.clientWidth;
            }) || (item.entry.end ? item.entry.end.slice(0, 4) : 'Hoy');
            if (item.height < 60
                && context.measureText(startDate.textContent).width + context.measureText(endDate.textContent).width + 5 > dates.clientWidth) {
                var compactStart = startLabels[startLabels.length - 1];
                var compactEnd = endLabels[endLabels.length - 1];
                if (context.measureText(compactStart).width + context.measureText(compactEnd).width + 5 <= dates.clientWidth) {
                    startDate.textContent = compactStart;
                    endDate.textContent = compactEnd;
                }
            }
            if (context.measureText(startDate.textContent + ' — ' + endDate.textContent).width + 5 <= dates.clientWidth) {
                startDate.textContent += ' —';
            } else if (context.measureText(startDate.textContent + ' - ' + endDate.textContent).width + 5 <= dates.clientWidth) {
                startDate.textContent += ' -';
            }
        }
        if (institution && !button.closest('.timeline-event-compact')) {
            primary.textContent = primaryText;
            institution.textContent = item.entry.organization;
            if (button.scrollHeight <= button.clientHeight) {
                return;
            }
        }
        fitJourneyText(context, primary, primaryText);
        if (institution) {
            fitJourneyText(context, institution, item.entry.organization);
        }
    });
}

function renderJourneyTimeline() {
    var timeline = document.querySelector('.journey-timeline');
    var axis = timeline.querySelector('.timeline-axis');
    var list = timeline.querySelector('.timeline-events');
    var detail = document.querySelector('#journey-detail');
    var today = new Date();
    var todayUTC = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    var axisStart = Date.UTC(2017, 0, 1);
    var entries = buildJourneyEntries().filter(function(entry) {
        return !entry.planned;
    }).map(function(entry) {
        var start = Date.parse(entry.start + 'T00:00:00Z');
        var end = entry.end ? Date.parse(entry.end + 'T00:00:00Z')
            : entry.type === 'experience' ? Math.max(todayUTC, start) : start;
        if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
            throw new Error('Invalid date range in journey: ' + entry.title);
        }
        if (entry.type === 'experience' && entry.institutionType !== 'public' && entry.institutionType !== 'private') {
            throw new Error('Invalid institution type in journey: ' + entry.organization);
        }

        return {
            entry: entry,
            start: Math.max(start, axisStart),
            end: Math.min(end, todayUTC),
            duration: entry.type === 'experience' ? getJourneyDuration(start, end) : null
        };
    }).filter(function(item) {
        return item.start <= item.end;
    });
    var latest = todayUTC;
    var pixelsPerMillisecond = 160 / (365.2425 * 24 * 60 * 60 * 1000);
    var axisHeight = (latest - axisStart) * pixelsPerMillisecond;
    var axisPadding = 64;
    var minimumCardHeight = 48;
    var groups = { experience: [], education: [] };

    timeline.style.height = (axisHeight + axisPadding * 2) + 'px';
    axis.style.top = axisPadding + 'px';
    axis.style.height = axisHeight + 'px';
    axis.innerHTML = '<span class="timeline-axis-tooltip" hidden></span>';

    var covidBand = timeline.querySelector('.timeline-covid-band');
    var covidStart = Math.max(Date.UTC(2020, 2, 16), axisStart);
    var covidEnd = Math.min(Date.UTC(2020, 6, 1), latest);
    covidBand.hidden = covidEnd <= covidStart;
    if (!covidBand.hidden) {
        covidBand.style.top = (axisPadding + (latest - covidEnd) * pixelsPerMillisecond) + 'px';
        covidBand.style.height = ((covidEnd - covidStart) * pixelsPerMillisecond) + 'px';
    }

    for (var year = new Date(axisStart).getUTCFullYear(); year <= new Date(latest).getUTCFullYear(); year++) {
        var tick = document.createElement('span');
        tick.className = 'timeline-year';
        tick.style.top = ((latest - Date.UTC(year, 0, 1)) * pixelsPerMillisecond) + 'px';
        tick.textContent = year;
        axis.appendChild(tick);
    }

    entries.sort(function(first, second) {
        return second.end - first.end || second.start - first.start;
    }).forEach(function(item) {
        item.top = axisPadding + (latest - item.end) * pixelsPerMillisecond;
        item.height = Math.max((item.end - item.start) * pixelsPerMillisecond, minimumCardHeight);
        var typeGroups = groups[item.entry.type];
        var group = typeGroups[typeGroups.length - 1];
        if (!group || item.end < group.start) {
            group = { lanes: [], items: [], start: item.start };
            typeGroups.push(group);
        }
        var lane = group.lanes.findIndex(function(start) {
            return item.end < start;
        });
        if (lane === -1) {
            lane = group.lanes.length;
        }
        group.lanes[lane] = item.start;
        group.start = Math.min(group.start, item.start);
        group.items.push(item);
        item.lane = lane;
    });

    Object.keys(groups).forEach(function(type) {
        groups[type].forEach(function(group, groupIndex, typeGroups) {
            var nextGroup = typeGroups[groupIndex + 1];
            group.items.forEach(function(item, index) {
                // A minimum-height card must not cover the next non-overlapping period.
                var nextInLane = group.items.slice(index + 1).find(function(next) {
                    return next.lane === item.lane;
                });
                var nextTop = nextInLane ? nextInLane.top : Infinity;
                if (nextGroup) {
                    nextTop = Math.min(nextTop, nextGroup.items[0].top);
                }
                item.height = Math.min(item.height, nextTop - item.top);
                item.lanes = group.lanes.length;
            });
        });
    });

    list.innerHTML = entries.map(function(item, index) {
        var entry = item.entry;
        var dateLabel = formatJourneyDateLabel(entry);
        var durationLabel = item.duration ? item.duration.full : 'Hito';
        var institutionLabel = entry.institutionType === 'public' ? 'Institución pública'
            : entry.institutionType === 'private' ? 'Institución privada' : '';
        var primaryLabel = entry.type === 'experience' || entry.milestone ? entry.title : entry.career || entry.level;
        var metaLabel = entry.type === 'experience' ? durationLabel
            : entry.milestone ? formatEducationDate(entry.start)
            : entry.career && entry.end ? dateLabel
            : entry.end ? formatEducationDate(entry.end) : 'En curso';
        var sectorLabel = entry.sector ? 'Sector: ' + entry.sector : '';
        var icon = entry.type === 'experience' ? getJourneySectorIcon(entry.sector)
            : entry.milestone ? 'workspace_premium' : '';
        return `
            <li class="timeline-event timeline-event-${entry.type}${entry.institutionType ? ' timeline-event-' + entry.institutionType : ''}${entry.milestone ? ' timeline-event-milestone' : ''}${item.height < 52 ? ' timeline-event-compact' : ''}${item.height < 36 ? ' timeline-event-short' : ''}${item.height < 18 ? ' timeline-event-tiny' : ''}"
                style="--event-top: ${item.top}px; --event-height: ${item.height}px; --lane: ${item.lane}; --lanes: ${item.lanes}">
                <button class="timeline-card" type="button" data-journey-index="${index}"
                    aria-label="${escapeHTML([entry.type === 'education' ? 'Educación: ' + primaryLabel : 'Experiencia: ' + primaryLabel, entry.organization, institutionLabel, sectorLabel, dateLabel, item.duration ? durationLabel : ''].filter(Boolean).join(', '))}"
                    title="${escapeHTML([primaryLabel, entry.organization, institutionLabel, sectorLabel, dateLabel, item.duration ? durationLabel : ''].filter(Boolean).join(' · '))}">
                    <span class="timeline-card-heading">
                        ${icon ? `<span class="material-symbols-outlined timeline-card-icon" aria-hidden="true">${escapeHTML(icon)}</span>` : ''}
                        <span class="timeline-card-label">${escapeHTML(primaryLabel)}</span>
                    </span>
                    ${entry.type === 'education' && !entry.milestone ? `<span class="timeline-card-institution">${escapeHTML(entry.organization)}</span>` : ''}
                    <span class="timeline-card-meta">${escapeHTML(metaLabel)}</span>
                    ${entry.type === 'experience' ? `
                        <span class="timeline-card-dates" aria-hidden="true">
                            <span class="timeline-card-start">${escapeHTML(formatJourneyExperienceDate(entry.start))} —</span>
                            <span class="timeline-card-end">${escapeHTML(entry.end ? formatJourneyExperienceDate(entry.end) : 'Actualidad')}</span>
                        </span>
                    ` : ''}
                </button>
            </li>
        `;
    }).join('');

    if (journeyResizeObserver) {
        journeyResizeObserver.disconnect();
    }
    journeyResizeObserver = new ResizeObserver(function() {
        fitJourneyCardLabels(list, entries);
    });
    journeyResizeObserver.observe(timeline);
    list.querySelectorAll('.timeline-card').forEach(function(button) {
        journeyResizeObserver.observe(button);
    });

    list.onclick = function(event) {
        var button = event.target.closest('[data-journey-index]');
        if (!button) {
            return;
        }
        var item = entries[Number(button.getAttribute('data-journey-index'))];
        var entry = item.entry;
        var tags = (entry.tags || []).map(function(tag) {
            return `<span class="timeline-tag">${escapeHTML(tag)}</span>`;
        });
        if (entry.extraSkillCount) {
            tags.push(`<span class="timeline-tag">+${entry.extraSkillCount} habilidades</span>`);
        }

        detail.querySelector('.journey-detail-content').innerHTML = `
            <span class="timeline-date">${escapeHTML(formatJourneyDateLabel(entry))}</span>
            ${item.duration ? `<span class="timeline-date">Duración: ${escapeHTML(item.duration.full)}</span>` : ''}
            ${entry.type === 'education' ? '<span class="timeline-type timeline-type-education">Educación</span>' : ''}
            ${entry.institutionType ? `<span class="timeline-type timeline-type-${entry.institutionType}">${entry.institutionType === 'public' ? 'Institución pública' : 'Institución privada'}</span>` : ''}
            <h3 id="journey-detail-title">${escapeHTML(entry.title)}</h3>
            <p class="timeline-organization">${escapeHTML(entry.organization)}</p>
            <p class="timeline-description">${escapeHTML(entry.description || '')}</p>
            <div class="timeline-tags">${tags.join('')}</div>
        `;
        detail.showModal();
    };
    detail.onkeydown = function(event) {
        if (event.key === 'Escape') {
            event.preventDefault();
            detail.close();
        }
    };

    axis.onpointermove = function(event) {
        var offset = Math.max(0, Math.min(axisHeight, event.clientY - axis.getBoundingClientRect().top));
        var date = new Date(latest - offset / pixelsPerMillisecond);
        var tooltip = axis.querySelector('.timeline-axis-tooltip');
        tooltip.textContent = new Intl.DateTimeFormat('es-PE', {
            month: 'long', year: 'numeric', timeZone: 'UTC'
        }).format(date);
        tooltip.style.top = offset + 'px';
        tooltip.hidden = false;
    };
    axis.onpointerleave = function() {
        axis.querySelector('.timeline-axis-tooltip').hidden = true;
    };
}

function formatJourneyExperienceDate(date, shortYear) {
    return new Intl.DateTimeFormat('es-PE', {
        day: '2-digit',
        month: '2-digit',
        year: shortYear ? '2-digit' : 'numeric',
        timeZone: 'UTC'
    }).format(new Date(date + 'T00:00:00Z'));
}

function formatJourneyDateLabel(entry) {
    if (entry.type === 'experience') {
        return formatJourneyExperienceDate(entry.start) + ' — '
            + (entry.end ? formatJourneyExperienceDate(entry.end) : 'Actualidad');
    }
    if (entry.end) {
        return formatEducationDate(entry.start) + ' — ' + formatEducationDate(entry.end);
    }
    return formatEducationDate(entry.start);
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