import { createTimelineController } from './timeline-controller.mjs';
import commitMessages from './commit-messages.js';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';
import scrollama from 'https://cdn.jsdelivr.net/npm/scrollama@3.2.0/+esm';

async function loadData() {
  return d3.csv('loc.csv', row => ({
    ...row,
    line: Number(row.line),
    depth: Number(row.depth),
    length: Number(row.length),
    date: new Date(`${row.date}T00:00${row.timezone}`),
    datetime: new Date(row.datetime),
  }));
}

function processCommits(data) {
  return d3.groups(data, d => d.commit).map(([id, lines]) => {
    const { author, date, time, timezone, datetime } = lines[0];
    const commit = {
      id, author, date, time, timezone, datetime,
      url: `https://github.com/marcusderamos/portfolio/commit/${id}`,
      hourFrac: datetime.getHours() + datetime.getMinutes() / 60,
      totalLines: lines.length,
    };
    Object.defineProperty(commit, 'lines', {
      value: lines, enumerable: false, writable: false, configurable: false,
    });
    return commit;
  }).sort((a, b) => a.datetime - b.datetime || a.id.localeCompare(b.id));
}

function renderCommitInfo(data, commits) {
  const files = d3.groups(data, d => d.file);
  const stats = [
    ['Lines of code', data.length],
    ['Contributing commits', commits.length],
    ['Files', files.length],
    ['Average line length', `${(d3.mean(data, d => d.length) || 0).toFixed(1)} characters`],
    ['Longest line', `${d3.max(data, d => d.length) || 0} characters`],
    ['Maximum depth', d3.max(data, d => d.depth) || 0],
  ];
  d3.select('#stats').selectAll('*').remove();
  const dl = d3.select('#stats').append('dl').attr('class', 'stats');
  for (const [label, value] of stats) {
    const item = dl.append('div').attr('class', 'stat-item');
    item.append('dt').text(label);
    item.append('dd').text(value);
  }
}

const tooltip = document.querySelector('#commit-tooltip');
let hideTimer;
function hideTooltip() {
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    if (!tooltip.matches(':hover, :focus-within')) tooltip.hidden = true;
  }, 180);
}
function showTooltip(event, commit) {
  clearTimeout(hideTimer);
  const link = document.querySelector('#commit-link');
  link.href = commit.url;
  link.textContent = commit.id.slice(0, 8);
  document.querySelector('#commit-date').textContent = commit.datetime.toLocaleDateString(undefined, { dateStyle: 'long' });
  document.querySelector('#commit-time').textContent = commit.datetime.toLocaleTimeString(undefined, { timeStyle: 'short' });
  document.querySelector('#commit-author').textContent = commit.author;
  document.querySelector('#commit-lines').textContent = `${commit.totalLines} surviving lines`;
  tooltip.hidden = false;
  const rect = event.currentTarget.getBoundingClientRect();
  const x = event.clientX || rect.right;
  const y = event.clientY || rect.top;
  tooltip.style.left = `${Math.max(8, Math.min(x + 12, innerWidth - tooltip.offsetWidth - 8))}px`;
  tooltip.style.top = `${Math.max(8, Math.min(y + 12, innerHeight - tooltip.offsetHeight - 8))}px`;
}
tooltip.addEventListener('mouseenter', () => clearTimeout(hideTimer));
tooltip.addEventListener('mouseleave', hideTooltip);
tooltip.addEventListener('focusout', hideTooltip);
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') tooltip.hidden = true;
});

function renderLanguageBreakdown(selectedCommits) {
  const lines = selectedCommits.flatMap(d => d.lines);
  const container = d3.select('#language-breakdown');
  container.selectAll('*').remove();
  const names = { js: 'JavaScript', html: 'HTML', css: 'CSS', json: 'JSON', md: 'Markdown' };
  const groups = d3.rollups(lines, rows => rows.length, d => d.type).sort((a, b) => b[1] - a[1]);
  for (const [language, count] of groups) {
    const item = container.append('div').attr('class', 'stat-item');
    item.append('dt').text(names[language] || language);
    item.append('dd').text(`${count} lines (${d3.format('.1%')(count / lines.length)})`);
  }
}

function renderScatterPlot(data, commits) {
  const width = 1000, height = 600;
  const margin = { top: 35, right: 40, bottom: 65, left: 70 };
  const area = { left: margin.left, right: width - margin.right, top: margin.top, bottom: height - margin.bottom };
  let [minDate, maxDate] = d3.extent(commits, d => d.datetime);
  if (+minDate === +maxDate) {
    minDate = d3.timeDay.offset(minDate, -1);
    maxDate = d3.timeDay.offset(maxDate, 1);
  }
  const xScale = d3.scaleTime().domain([minDate, maxDate]).nice().range([area.left + 25, area.right - 25]);
  const yScale = d3.scaleLinear().domain([0, 24]).range([area.bottom, area.top]);
  // Zero-based square-root radius makes circle area proportional to line count.
  const rScale = d3.scaleSqrt().domain([0, d3.max(commits, d => d.totalLines)]).range([0, 25]);
  const svg = d3.select('#chart').append('svg').attr('viewBox', `0 0 ${width} ${height}`)
    .attr('role', 'group').attr('aria-label', 'Commit dates and local time of day; drag to select commits');
  svg.append('g').attr('class', 'gridlines').attr('transform', `translate(${area.left},0)`)
    .call(d3.axisLeft(yScale).tickValues(d3.range(0, 25, 3)).tickFormat('').tickSize(-(area.right - area.left)));
  svg.append('g').attr('class', 'axis').attr('transform', `translate(0,${area.bottom})`)
    .call(d3.axisBottom(xScale).ticks(6).tickFormat(d3.timeFormat('%b %d')));
  svg.append('g').attr('class', 'axis').attr('transform', `translate(${area.left},0)`)
    .call(d3.axisLeft(yScale).tickValues(d3.range(0, 25, 3)).tickFormat(h => `${String(h).padStart(2, '0')}:00`));
  svg.append('text').attr('class', 'axis-label').attr('x', (area.left + area.right) / 2).attr('y', height - 12).attr('text-anchor', 'middle').text('Commit date');
  svg.append('text').attr('class', 'axis-label').attr('transform', 'rotate(-90)').attr('x', -(area.top + area.bottom) / 2).attr('y', 18).attr('text-anchor', 'middle').text('Local time of day');

  // Brush is below dots: it catches background drags without blocking tooltips.
  const brushLayer = svg.append('g').attr('class', 'commit-brush');
  const dotLayer = svg.append('g').attr('class', 'dots');
  let dots = dotLayer.selectAll('circle');
  let visibleCommits = commits;

  function isCommitSelected(selection, commit) {
    if (!selection) return false;
    const [[x0, y0], [x1, y1]] = selection;
    const x = xScale(commit.datetime), y = yScale(commit.hourFrac);
    return x >= x0 && x <= x1 && y >= y0 && y <= y1;
  }
  function brushed(event) {
    const selected = visibleCommits.filter(d => isCommitSelected(event.selection, d));
    dots.classed('selected', d => isCommitSelected(event.selection, d));
    document.querySelector('#selection-count').textContent = selected.length
      ? `${selected.length} commit${selected.length === 1 ? '' : 's'} selected`
      : 'No commits selected';
    renderLanguageBreakdown(selected);
    tooltip.hidden = true;
  }
  const brush = d3.brush().extent([[area.left, area.top], [area.right, area.bottom]])
    .on('start brush end', brushed);
  brushLayer.call(brush);
  document.querySelector('#clear-selection').addEventListener('click', () => brushLayer.call(brush.move, null));
  function update(filteredCommits, activeId = null) {
    visibleCommits = filteredCommits;
    tooltip.hidden = true;
    brushLayer.call(brush.move, null);
    // Keep the full-history axes and radius scale fixed for a stable comparison.
    dots = dotLayer.selectAll('circle')
      .data(d3.sort(filteredCommits, d => -d.totalLines), d => d.id)
      .join('circle')
      .attr('cx', d => xScale(d.datetime)).attr('cy', d => yScale(d.hourFrac))
      .style('r', d => `${rScale(d.totalLines)}px`)
      .attr('tabindex', 0).attr('role', 'button')
      .attr('aria-label', d => `${d.id.slice(0, 8)}, ${d.datetime.toLocaleString()}, ${d.totalLines} lines. Enter to open commit.`)
      .on('mouseenter focus', showTooltip).on('mousemove', showTooltip)
      .on('mouseleave blur', hideTooltip)
      .on('keydown', (event, commit) => {
        if (event.key === 'Enter') window.open(commit.url, '_blank', 'noopener');
      });
    dots.classed('active-commit', d => d.id === activeId)
      .classed('earlier-commit', d => activeId !== null && d.id !== activeId);
    dots.selectAll('title').data(d => [d]).join('title').text(d => `${d.author}: ${d.totalLines} lines`);
  }
  update(commits);
  return update;
}

try {
  const data = await loadData();
  if (!data.length) throw new Error('The analysis CSV is empty.');
  if (data.some(d => !Number.isFinite(+d.datetime))) throw new Error('The CSV contains invalid commit dates.');
  const commits = processCommits(data);
  const updateScatterPlot = renderScatterPlot(data, commits);
  const slider = document.querySelector('#commit-progress');
  const cutoffLabel = document.querySelector('#commit-cutoff');
  const timeScale = d3.scaleTime().domain(d3.extent(commits, d => d.datetime)).range([0, 100]);
  const colors = d3.scaleOrdinal([...new Set(data.map(d => d.type))].sort(), d3.schemeTableau10);
  const names = {js: 'JavaScript', html: 'HTML', css: 'CSS', json: 'JSON', md: 'Markdown'};
  const legend = d3.select('#file-legend').selectAll('li').data(colors.domain()).join('li');
  legend.append('span').attr('class', 'file-swatch').style('background', d => colors(d));
  legend.append('span').text(d => names[d] || d);

  function updateFileDisplay(filteredCommits) {
    const files = d3.groups(filteredCommits.flatMap(d => d.lines), d => d.file)
      .map(([name, lines]) => ({name, lines: lines.sort((a, b) => a.datetime - b.datetime || a.line - b.line)}))
      .sort((a, b) => b.lines.length - a.lines.length || a.name.localeCompare(b.name));
    const rows = d3.select('#files').selectAll('.file-row').data(files, d => d.name).join(enter => {
      const row = enter.append('div').attr('class', 'file-row');
      const label = row.append('dt');
      label.append('code'); label.append('small');
      row.append('dd'); return row;
    }).order();
    rows.select('code').text(d => d.name);
    rows.select('small').text(d => `${d.lines.length.toLocaleString()} lines`);
    rows.select('dd').attr('aria-label', d => `${d.lines.length} lines in ${d.name}`)
      .selectAll('.loc').data(d => d.lines, d => `${d.file}:${d.line}`)
      .join('div').attr('class', 'loc').style('--color', d => colors(d.type))
      .attr('title', d => `${d.file}:${d.line} · ${names[d.type] || d.type} · ${d.datetime.toLocaleDateString()}`);
  }

  const steps = d3.select('#scatter-story').selectAll('.step').data(commits, d => d.id)
    .join('article').attr('class', 'step').attr('tabindex', 0);
  steps.append('h3').text((d, i) => {
    const hash = Object.keys(commitMessages).find(hash => hash.startsWith(d.id));
    return hash ? commitMessages[hash] : `Commit ${i + 1}`;
  });
  steps.append('time').attr('datetime', d => d.datetime.toISOString())
    .text(d => d.datetime.toLocaleString(undefined, {dateStyle: 'long', timeStyle: 'short'}));
  steps.append('p').text(d => {
    const count = new Set(d.lines.map(line => line.file)).size;
    return `${d.totalLines} surviving ${d.totalLines === 1 ? 'line' : 'lines'} across ${count} ${count === 1 ? 'file' : 'files'}.`;
  });
  steps.append('a').attr('href', d => d.url).attr('target', '_blank').attr('rel', 'noopener')
    .text(d => `View commit ${d.id.slice(0, 8)}`);

  function updateUntil(cutoff, activeId = null) {
    const filtered = commits.filter(d => d.datetime <= cutoff);
    slider.value = timeScale(cutoff);
    cutoffLabel.dateTime = cutoff.toISOString();
    cutoffLabel.textContent = cutoff.toLocaleString(undefined, {dateStyle: 'long', timeStyle: 'short'});
    slider.setAttribute('aria-valuetext', cutoffLabel.textContent);
    steps.classed('is-active', d => d.id === activeId);
    renderCommitInfo(filtered.flatMap(d => d.lines), filtered);
    updateScatterPlot(filtered, activeId);
    updateFileDisplay(filtered);
  }
  const followScroll = document.querySelector('#follow-scroll');
  const timelineStatus = document.querySelector('#timeline-status');
  const timeline = createTimelineController((cutoff, activeId, followingScroll) => {
    followScroll.checked = followingScroll;
    timelineStatus.textContent = followingScroll
      ? 'Following the narrative as you scroll.'
      : 'Manual selection. Enable “Follow scrolling” to resume the narrative.';
    updateUntil(cutoff, activeId);
  });
  slider.addEventListener('input', () => timeline.select(timeScale.invert(Number(slider.value))));
  document.querySelector('#show-all-commits').addEventListener('click', () => timeline.select(commits.at(-1).datetime));
  followScroll.addEventListener('change', () => {
    timelineStatus.textContent = followScroll.checked
      ? 'Following the narrative as you scroll.'
      : 'Manual selection. Enable “Follow scrolling” to resume the narrative.';
    timeline.follow(followScroll.checked);
  });
  steps.on('focusin', (event, d) => timeline.select(d.datetime, d.id));
  updateUntil(commits.at(-1).datetime);
  const scroller = scrollama().setup({step: '#scatter-story .step', offset: 0.5})
    .onStepEnter(({element}) => timeline.enterStep(element.__data__.datetime, element.__data__.id));
  window.addEventListener('resize', () => scroller.resize());
} catch (error) {
  console.error('Unable to load code history:', error);
  const message = document.querySelector('#meta-error');
  message.hidden = false;
  message.textContent = 'Code history could not be loaded. Run npm run analyze, then open this page through Live Server.';
}
