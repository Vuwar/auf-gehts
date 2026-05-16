using System.Text.Json.Serialization;
using Api.Data;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles;
});

builder.Services.AddOpenApi();
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins("http://localhost:3000")
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.UseCors();
}

app.UseHttpsRedirection();

// Deck endpoints
app.MapGet("/api/decks", async (AppDbContext db) =>
    await db.Decks.OrderByDescending(d => d.CreatedAt).ToListAsync());

app.MapGet("/api/decks/{id}", async (Guid id, AppDbContext db) =>
    await db.Decks.Include(d => d.FlashCards).FirstOrDefaultAsync(d => d.Id == id)
        is { } deck ? Results.Ok(deck) : Results.NotFound());

app.MapPost("/api/decks", async (Api.Models.Deck deck, AppDbContext db) =>
{
    db.Decks.Add(deck);
    await db.SaveChangesAsync();
    return Results.Created($"/api/decks/{deck.Id}", deck);
});

app.MapDelete("/api/decks/{id}", async (Guid id, AppDbContext db) =>
{
    var deck = await db.Decks.FindAsync(id);
    if (deck is null) return Results.NotFound();
    db.Decks.Remove(deck);
    await db.SaveChangesAsync();
    return Results.NoContent();
});

// FlashCard endpoints
app.MapGet("/api/decks/{deckId}/flashcards", async (Guid deckId, AppDbContext db) =>
    await db.FlashCards.Where(f => f.DeckId == deckId).OrderBy(f => f.CreatedAt).ToListAsync());

app.MapPost("/api/decks/{deckId}/flashcards", async (Guid deckId, Api.Models.FlashCard card, AppDbContext db) =>
{
    card.DeckId = deckId;
    db.FlashCards.Add(card);
    await db.SaveChangesAsync();
    return Results.Created($"/api/decks/{deckId}/flashcards/{card.Id}", card);
});

app.MapPut("/api/flashcards/{id}", async (Guid id, Api.Models.FlashCard updated, AppDbContext db) =>
{
    var card = await db.FlashCards.FindAsync(id);
    if (card is null) return Results.NotFound();
    card.Front = updated.Front;
    card.Back = updated.Back;
    await db.SaveChangesAsync();
    return Results.Ok(card);
});

app.MapDelete("/api/flashcards/{id}", async (Guid id, AppDbContext db) =>
{
    var card = await db.FlashCards.FindAsync(id);
    if (card is null) return Results.NotFound();
    db.FlashCards.Remove(card);
    await db.SaveChangesAsync();
    return Results.NoContent();
});

app.Run();
