#!/usr/bin/env node
/**
 * setup.js  –  Run this once to write all view files fresh.
 * Usage:  node setup.js
 */
const fs   = require('fs');
const path = require('path');

function write(filePath, content) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('✅ wrote', filePath);
}

const base = __dirname;

// ── layout.ejs ────────────────────────────────────────────────────────────
write(path.join(base,'views','layout.ejs'), `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><%= typeof title !== 'undefined' ? title : 'Quote System' %> — WovenBag</title>
  <link rel="stylesheet" href="/css/style.css">
</head>
<body>
<% if (typeof user !== "undefined" && user && user.userId) { %>
<nav class="navbar">
  <div class="nav-brand">
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><rect width="28" height="28" rx="6" fill="#2563eb"/><path d="M7 10h14M7 14h14M7 18h8" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>
    WovenBag Quotes
  </div>
  <div class="nav-links">
    <a href="/quotes" class="<%= typeof activePage !== 'undefined' && activePage === 'quotes' ? 'active' : '' %>">📋 Quotes</a>
    <a href="/quotes/new" class="<%= typeof activePage !== 'undefined' && activePage === 'new' ? 'active' : '' %>">➕ New Quote</a>
    <% if (user.userRole === 'admin') { %>
    <a href="/admin" class="<%= typeof activePage !== 'undefined' && activePage === 'admin' ? 'active' : '' %>">⚙️ Admin</a>
    <a href="/admin/audit" class="<%= typeof activePage !== 'undefined' && activePage === 'audit' ? 'active' : '' %>">📜 Audit</a>
    <% } %>
  </div>
  <div class="nav-user">
    <span class="avatar"><%= user.fullName.charAt(0).toUpperCase() %></span>
    <span><%= user.fullName %></span>
    <% if (user.userRole === 'admin') { %><span class="badge-admin">Admin</span><% } %>
    <a href="/logout" class="btn-logout">Logout</a>
  </div>
</nav>
<% } %>
<main class="main-content">
`);

// ── layout_footer.ejs ─────────────────────────────────────────────────────
write(path.join(base,'views','layout_footer.ejs'), `</main>
<script src="/js/app.js"></script>
</body>
</html>
`);

// ── login.ejs ─────────────────────────────────────────────────────────────
write(path.join(base,'views','login.ejs'), `<% var title='Login'; var activePage=''; %>
<%- include('layout') %>
<div class="auth-container">
  <div class="auth-card">
    <div class="auth-logo">
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="12" fill="#2563eb"/><path d="M12 17h24M12 24h24M12 31h14" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/></svg>
      <h1>WovenBag Quotes</h1>
      <p>Sign in to manage your quotes</p>
    </div>
    <% if (typeof registered !== 'undefined' && registered) { %>
    <div class="alert alert-success">✅ Registration successful! Please sign in.</div>
    <% } %>
    <% if (error) { %><div class="alert alert-danger">⚠️ <%= error %></div><% } %>
    <form method="POST" action="/login">
      <input type="hidden" name="next" value="<%= typeof next !== 'undefined' ? next : '/' %>">
      <div class="form-group"><label>Username</label>
        <input type="text" name="username" required placeholder="Enter username"></div>
      <div class="form-group"><label>Password</label>
        <input type="password" name="password" required placeholder="Enter password"></div>
      <button type="submit" class="btn btn-primary btn-full">Sign In</button>
    </form>
    <p class="auth-footer">Don't have an account? <a href="/register">Register here</a></p>
  </div>
</div>
<%- include('layout_footer') %>
`);

// ── register.ejs ──────────────────────────────────────────────────────────
write(path.join(base,'views','register.ejs'), `<% var title='Register'; var activePage=''; %>
<%- include('layout') %>
<div class="auth-container">
  <div class="auth-card">
    <div class="auth-logo">
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="12" fill="#2563eb"/><path d="M12 17h24M12 24h24M12 31h14" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/></svg>
      <h1>Create Account</h1><p>Register to start creating quotes</p>
    </div>
    <% if (error) { %><div class="alert alert-danger">⚠️ <%= error %></div><% } %>
    <form method="POST" action="/register">
      <div class="form-group"><label>Full Name</label><input type="text" name="full_name" required placeholder="Your full name"></div>
      <div class="form-group"><label>Username</label><input type="text" name="username" required placeholder="Choose a username"></div>
      <div class="form-group"><label>Email</label><input type="email" name="email" required placeholder="your@email.com"></div>
      <div class="form-group"><label>Password</label><input type="password" name="password" required placeholder="Min 6 characters"></div>
      <div class="form-group"><label>Confirm Password</label><input type="password" name="confirm_password" required placeholder="Repeat password"></div>
      <button type="submit" class="btn btn-primary btn-full">Create Account</button>
    </form>
    <p class="auth-footer">Already have an account? <a href="/login">Sign in</a></p>
  </div>
</div>
<%- include('layout_footer') %>
`);

// ── error.ejs ─────────────────────────────────────────────────────────────
write(path.join(base,'views','error.ejs'), `<% var title='Error'; var activePage=''; %>
<%- include('layout') %>
<div class="error-page">
  <div class="error-icon">⚠️</div>
  <h2><%= message %></h2>
  <a href="javascript:history.back()" class="btn btn-secondary">← Go Back</a>
  <a href="/quotes" class="btn btn-primary">Go to Quotes</a>
</div>
<%- include('layout_footer') %>
`);

// ── quotes/list.ejs ───────────────────────────────────────────────────────
write(path.join(base,'views','quotes','list.ejs'), `<% var title='Quotes'; var activePage='quotes';
   var sc={draft:'badge-gray',sent:'badge-blue',accepted:'badge-green',rejected:'badge-red'}; %>
<%- include('../layout') %>
<div class="page-header">
  <div><h1>Quotes</h1>
    <p class="subtitle"><%= user.userRole==='admin'?'All quotes in the system':'Your quotes' %></p></div>
  <a href="/quotes/new" class="btn btn-primary">➕ New Quote</a>
</div>
<div class="filter-bar">
  <form method="GET" action="/quotes" class="filter-form">
    <input type="text" name="search" placeholder="Search quote #, customer, company…"
      value="<%= typeof search!=='undefined'&&search?search:'' %>" class="search-input">
    <select name="status">
      <option value="">All Status</option>
      <option value="draft"    <%=typeof status!=='undefined'&&status==='draft'   ?'selected':''%>>Draft</option>
      <option value="sent"     <%=typeof status!=='undefined'&&status==='sent'    ?'selected':''%>>Sent</option>
      <option value="accepted" <%=typeof status!=='undefined'&&status==='accepted'?'selected':''%>>Accepted</option>
      <option value="rejected" <%=typeof status!=='undefined'&&status==='rejected'?'selected':''%>>Rejected</option>
    </select>
    <button type="submit" class="btn btn-secondary">Filter</button>
    <a href="/quotes" class="btn btn-ghost">Clear</a>
  </form>
</div>
<div class="card">
  <% if(quotes.length===0){ %>
  <div class="empty-state"><div style="font-size:3rem">📋</div><h3>No quotes found</h3>
    <p>Start by creating your first quote</p><a href="/quotes/new" class="btn btn-primary">Create Quote</a></div>
  <% } else { %>
  <table class="table">
    <thead><tr><th>Quote #</th><th>Customer</th><th>Company</th><th>Size (W×L)</th>
      <th>₹/Bag</th><th>₹/Kg</th><th>Status</th><th>Created By</th><th>Date</th><th>Actions</th></tr></thead>
    <tbody>
    <% quotes.forEach(function(q){ %>
      <tr>
        <td><a href="/quotes/<%=q.id%>" class="quote-link"><%=q.quote_number%></a></td>
        <td><%=q.customer_name%></td><td><%=q.customer_company||'—'%></td>
        <td><%=q.width_value%>×<%=q.length_value%> <%=q.width_unit%></td>
        <td class="price-cell">₹<%=parseFloat(q.final_price_per_bag||0).toFixed(2)%></td>
        <td class="price-cell">₹<%=parseFloat(q.final_price_per_kg||0).toFixed(2)%></td>
        <td><span class="badge <%=sc[q.status]||'badge-gray'%>"><%=q.status%></span></td>
        <td><%=q.creator_name%></td>
        <td><%=new Date(q.created_at).toLocaleDateString('en-IN')%></td>
        <td class="actions-cell">
          <a href="/quotes/<%=q.id%>" class="btn-icon" title="View">👁</a>
          <a href="/quotes/<%=q.id%>/edit" class="btn-icon" title="Edit">✏️</a>
        </td>
      </tr>
    <% }); %>
    </tbody>
  </table>
  <div class="table-footer">Showing <%=quotes.length%> quote<%=quotes.length!==1?'s':''%></div>
  <% } %>
</div>
<%- include('../layout_footer') %>
`);

// ── quotes/view.ejs ───────────────────────────────────────────────────────
write(path.join(base,'views','quotes','view.ejs'), `<% var title=quote.quote_number; var activePage='quotes';
   var sc={draft:'badge-gray',sent:'badge-blue',accepted:'badge-green',rejected:'badge-red'}; %>
<%- include('../layout') %>
<div class="page-header">
  <div><h1><%=quote.quote_number%></h1>
    <p class="subtitle">Created by <%=quote.creator_name%> on <%=new Date(quote.created_at).toLocaleString('en-IN')%></p></div>
  <div class="header-actions">
    <span class="badge <%=sc[quote.status]||'badge-gray'%> badge-lg"><%=quote.status.toUpperCase()%></span>
    <a href="/quotes/<%=quote.id%>/edit" class="btn btn-secondary">✏️ Edit</a>
    <a href="/quotes" class="btn btn-ghost">← Back</a>
  </div>
</div>
<div class="card status-card">
  <strong>Update Status:</strong>
  <div class="status-buttons">
    <% ['draft','sent','accepted','rejected'].forEach(function(s){ %>
    <button onclick="updateStatus('<%=s%>')"
      class="btn btn-status <%=quote.status===s?'btn-status-active':''%> status-<%=s%>">
      <%=s.charAt(0).toUpperCase()+s.slice(1)%>
    </button>
    <% }); %>
  </div>
</div>
<div class="view-grid">
  <div>
    <div class="card"><h3 class="card-title">👤 Customer</h3>
      <table class="detail-table">
        <tr><td>Name</td><td><strong><%=quote.customer_name%></strong></td></tr>
        <tr><td>Email</td><td><%=quote.customer_email||'—'%></td></tr>
        <tr><td>Company</td><td><%=quote.customer_company||'—'%></td></tr>
      </table>
    </div>
    <div class="card"><h3 class="card-title">📐 Product Specifications</h3>
      <table class="detail-table">
        <tr><td>Size (W×L)</td><td><%=quote.width_value%> × <%=quote.length_value%> <%=quote.width_unit%></td></tr>
        <tr><td>Fabric GSM</td><td><%=quote.fabric_gsm%> <%=quote.fabric_type%></td></tr>
        <tr><td>Filler %</td><td><%=quote.filler_pct%>%</td></tr>
        <tr><td>Bag Style</td><td><%=quote.bag_style%></td></tr>
        <tr><td>Lamination</td><td><%=quote.lamination_included%> — <%=quote.lamination_side%> <%=quote.lamination_gsm%> GSM</td></tr>
        <tr><td>BOPP</td><td><%=quote.bopp_included%> — <%=quote.bopp_side%> <%=quote.bopp_micron%>µ (<%=quote.bopp_type%>/<%=quote.bopp_finish%>)</td></tr>
        <tr><td>Back Flexo</td><td><%=quote.back_flexo%></td></tr>
        <tr><td>Metalize</td><td><%=quote.metalize_included%><% if(quote.metalize_included==='Yes'){%> — <%=quote.metalize_side%> <%=quote.metalize_micron%>µ<%}%></td></tr>
        <tr><td>Handle</td><td><%=quote.handle_included%></td></tr>
        <tr><td>Liner</td><td><%=quote.liner_included%><% if(quote.liner_included==='Yes'){%> — <%=quote.liner_width%>×<%=quote.liner_length%> @ <%=quote.liner_thickness%> <%=quote.liner_thickness_unit%><%}%></td></tr>
        <tr><td>Freight</td><td><%=quote.freight%></td></tr>
      </table>
    </div>
    <% if(quote.notes){ %>
    <div class="card"><h3 class="card-title">📝 Notes</h3><p class="notes-text"><%=quote.notes%></p></div>
    <% } %>
  </div>
  <div>
    <div class="card pricing-card"><h3 class="card-title">💰 Pricing Breakdown</h3>
      <div class="price-highlight-box">
        <div class="price-big">
          <div><div class="price-label">Final Price / Bag</div>
            <div class="price-value">₹<%=parseFloat(quote.final_price_per_bag||0).toFixed(2)%></div></div>
          <div><div class="price-label">Final Price / Kg</div>
            <div class="price-value">₹<%=parseFloat(quote.final_price_per_kg||0).toFixed(2)%></div></div>
        </div>
        <div class="price-sub">Total Weight: <strong><%=parseFloat(quote.total_weight_gm||0).toFixed(2)%> gm/bag</strong></div>
      </div>
      <table class="detail-table mt-2">
        <tr class="table-section-head"><td colspan="2">Raw Material Costs</td></tr>
        <tr><td>PP Fabric + Filler</td><td>₹<%=result.ppFabricAmt.toFixed(2)%>/bag (<%=result.fabricWt.toFixed(1)%> gm)</td></tr>
        <tr><td>Lamination</td><td>₹<%=result.lamCost.toFixed(2)%>/bag (<%=result.lamWt.toFixed(1)%> gm)</td></tr>
        <tr><td>BOPP + Ink</td><td>₹<%=result.boppCost.toFixed(2)%>/bag (<%=result.boppWt.toFixed(1)%> gm)</td></tr>
        <tr><td>Metalize</td><td>₹<%=result.metCost.toFixed(2)%>/bag (<%=result.metWt.toFixed(1)%> gm)</td></tr>
        <tr><td>Handle</td><td>₹<%=result.handleCost.toFixed(2)%>/bag</td></tr>
        <tr><td>Liner</td><td>₹<%=result.linerCost.toFixed(2)%>/bag (<%=result.linerWt.toFixed(1)%> gm)</td></tr>
        <tr class="row-total"><td><strong>RM Total / Bag</strong></td><td><strong>₹<%=result.rmPricePerBag.toFixed(2)%></strong></td></tr>
        <tr class="row-total"><td><strong>RM Rate / Kg</strong></td><td><strong>₹<%=result.rmRatePerKg.toFixed(2)%></strong></td></tr>
        <tr class="table-section-head"><td colspan="2">Conversion Costs (₹/Kg)</td></tr>
        <tr><td>Width Surcharge</td><td>₹<%=result.convDetails.widthSurcharge.toFixed(2)%></td></tr>
        <tr><td>Bag Style</td><td>₹<%=result.convDetails.bagStyle.toFixed(2)%></td></tr>
        <tr><td>BOPP Type</td><td>₹<%=result.convDetails.boppType.toFixed(2)%></td></tr>
        <tr><td>Back Flexo</td><td>₹<%=result.convDetails.backFlexo.toFixed(2)%></td></tr>
        <tr><td>Finish (MAT)</td><td>₹<%=result.convDetails.finish.toFixed(2)%></td></tr>
        <tr><td>Metalize</td><td>₹<%=result.convDetails.metalizeBase.toFixed(2)%></td></tr>
        <tr><td>Metalize Window</td><td>₹<%=result.convDetails.metalizeWindows.toFixed(2)%></td></tr>
        <tr><td>Valve</td><td>₹<%=result.convDetails.valve.toFixed(2)%></td></tr>
        <tr><td>Hamming</td><td>₹<%=result.convDetails.hamming.toFixed(2)%></td></tr>
        <tr><td>Tuber</td><td>₹<%=result.convDetails.tuber.toFixed(2)%></td></tr>
        <tr><td>Handle Conv.</td><td>₹<%=result.convDetails.handleConv.toFixed(2)%></td></tr>
        <tr><td>Liner Conv.</td><td>₹<%=result.convDetails.linerConv.toFixed(2)%></td></tr>
        <tr><td>Freight</td><td>₹<%=result.convDetails.freight.toFixed(2)%></td></tr>
        <tr class="row-total"><td><strong>Total Conversion/Kg</strong></td><td><strong>₹<%=result.convDetails.total.toFixed(2)%></strong></td></tr>
        <tr class="table-section-head"><td colspan="2">Final Pricing</td></tr>
        <tr><td>SSP Rate / Kg</td><td>₹<%=result.sspRatePerKg.toFixed(2)%></td></tr>
        <tr><td>SSP Rate / Bag</td><td>₹<%=result.sspRatePerBag.toFixed(2)%></td></tr>
        <tr><td><%=quote.pricing_type%> (<%=quote.discount_pct%>%)</td><td>—</td></tr>
        <tr class="row-final"><td><strong>Final / Kg</strong></td><td><strong>₹<%=parseFloat(quote.final_price_per_kg).toFixed(2)%></strong></td></tr>
        <tr class="row-final"><td><strong>Final / Bag</strong></td><td><strong>₹<%=parseFloat(quote.final_price_per_bag).toFixed(2)%></strong></td></tr>
      </table>
    </div>
  </div>
</div>
<div class="card"><h3 class="card-title">📜 Audit Trail</h3>
  <% if(audit.length===0){ %><p class="text-muted">No audit records yet.</p>
  <% } else { %>
  <table class="table">
    <thead><tr><th>Action</th><th>By</th><th>Timestamp</th><th>IP</th></tr></thead>
    <tbody>
    <% audit.forEach(function(a){ %>
      <tr>
        <td><span class="audit-action"><%=a.action%></span></td>
        <td><%=a.actor_name%></td>
        <td><%=new Date(a.timestamp).toLocaleString('en-IN')%></td>
        <td class="text-muted"><%=a.ip_address%></td>
      </tr>
    <% }); %>
    </tbody>
  </table>
  <% } %>
</div>
<script>
async function updateStatus(status) {
  if (!confirm('Change status to "' + status + '"?')) return;
  var res = await fetch('/quotes/<%=quote.id%>/status', {
    method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:'status='+status
  });
  var json = await res.json();
  if (json.ok) location.reload(); else alert('Error: ' + json.error);
}
</script>
<%- include('../layout_footer') %>
`);

// ── admin/dashboard.ejs ───────────────────────────────────────────────────
write(path.join(base,'views','admin','dashboard.ejs'), `<% var title='Admin Dashboard'; var activePage='admin'; %>
<%- include('../layout') %>
<div class="page-header">
  <div><h1>⚙️ Admin Dashboard</h1><p class="subtitle">System overview and user management</p></div>
  <a href="/admin/audit" class="btn btn-secondary">📜 Full Audit Log</a>
</div>
<div class="stats-grid">
  <div class="stat-card"><div class="stat-icon">📋</div><div class="stat-value"><%=stats.totalQuotes%></div><div class="stat-label">Total Quotes</div></div>
  <div class="stat-card stat-blue"><div class="stat-icon">📝</div><div class="stat-value"><%=stats.draftQuotes%></div><div class="stat-label">Draft</div></div>
  <div class="stat-card stat-yellow"><div class="stat-icon">📤</div><div class="stat-value"><%=stats.sentQuotes%></div><div class="stat-label">Sent</div></div>
  <div class="stat-card stat-green"><div class="stat-icon">✅</div><div class="stat-value"><%=stats.acceptedQuotes%></div><div class="stat-label">Accepted</div></div>
  <div class="stat-card stat-purple"><div class="stat-icon">👥</div><div class="stat-value"><%=stats.totalUsers%></div><div class="stat-label">Users</div></div>
</div>
<div class="card"><h3 class="card-title">👥 User Management</h3>
  <table class="table">
    <thead><tr><th>Name</th><th>Username</th><th>Email</th><th>Role</th><th>Status</th><th>Last Login</th><th>Joined</th><th>Actions</th></tr></thead>
    <tbody>
    <% users.forEach(function(u){ %>
      <tr id="user-row-<%=u.id%>">
        <td><strong><%=u.full_name%></strong></td><td><%=u.username%></td><td><%=u.email%></td>
        <td>
          <select class="role-select" onchange="changeRole(<%=u.id%>,this.value)" <%=u.username==='admin'?'disabled':''%>>
            <option value="user"  <%=u.role==='user' ?'selected':''%>>User</option>
            <option value="admin" <%=u.role==='admin'?'selected':''%>>Admin</option>
          </select>
        </td>
        <td><span class="badge <%=u.is_active?'badge-green':'badge-red'%>" id="status-badge-<%=u.id%>"><%=u.is_active?'Active':'Inactive'%></span></td>
        <td class="text-muted"><%=u.last_login?new Date(u.last_login).toLocaleDateString('en-IN'):'Never'%></td>
        <td class="text-muted"><%=new Date(u.created_at).toLocaleDateString('en-IN')%></td>
        <td><% if(u.username!=='admin'){ %>
          <button onclick="toggleUser(<%=u.id%>)" class="btn btn-sm <%=u.is_active?'btn-danger':'btn-success'%>" id="toggle-btn-<%=u.id%>">
            <%=u.is_active?'Deactivate':'Activate'%></button>
          <% } else { %><span class="text-muted">—</span><% } %></td>
      </tr>
    <% }); %>
    </tbody>
  </table>
</div>
<script>
async function toggleUser(id) {
  if (!confirm('Toggle user status?')) return;
  var r = await fetch('/admin/users/'+id+'/toggle',{method:'POST'});
  var j = await r.json();
  if (j.ok) {
    document.getElementById('status-badge-'+id).textContent = j.is_active?'Active':'Inactive';
    document.getElementById('status-badge-'+id).className = 'badge '+(j.is_active?'badge-green':'badge-red');
    document.getElementById('toggle-btn-'+id).textContent = j.is_active?'Deactivate':'Activate';
    document.getElementById('toggle-btn-'+id).className = 'btn btn-sm '+(j.is_active?'btn-danger':'btn-success');
  } else alert(j.error);
}
async function changeRole(id,role) {
  if (!confirm('Change to '+role+'?')) return;
  var r = await fetch('/admin/users/'+id+'/role',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'role='+role});
  var j = await r.json(); if(!j.ok) alert(j.error||'Failed');
}
</script>
<%- include('../layout_footer') %>
`);

// ── admin/audit.ejs ───────────────────────────────────────────────────────
write(path.join(base,'views','admin','audit.ejs'), `<% var title='Audit Log'; var activePage='audit'; %>
<%- include('../layout') %>
<div class="page-header">
  <div><h1>📜 Audit Log</h1><p class="subtitle">Complete activity trail (last 500 entries)</p></div>
  <a href="/admin" class="btn btn-secondary">← Dashboard</a>
</div>
<div class="card">
  <% if(logs.length===0){ %><div class="empty-state"><p>No audit records yet.</p></div>
  <% } else { %>
  <table class="table">
    <thead><tr><th>#</th><th>Quote #</th><th>Action</th><th>By</th><th>Username</th><th>IP</th><th>Timestamp</th></tr></thead>
    <tbody>
    <% logs.forEach(function(log){ %>
      <tr>
        <td class="text-muted"><%=log.id%></td>
        <td><a href="/quotes/<%=log.quote_id%>" class="quote-link"><%=log.quote_number%></a></td>
        <td><span class="audit-action"><%=log.action%></span></td>
        <td><%=log.actor_name%></td><td class="text-muted">@<%=log.username%></td>
        <td class="text-muted font-mono"><%=log.ip_address%></td>
        <td class="text-muted"><%=new Date(log.timestamp).toLocaleString('en-IN')%></td>
      </tr>
    <% }); %>
    </tbody>
  </table>
  <div class="table-footer">Showing <%=logs.length%> entries</div>
  <% } %>
</div>
<%- include('../layout_footer') %>
`);

console.log('\n✅ All view files written successfully!');
console.log('   Now run:  npm start\n');
