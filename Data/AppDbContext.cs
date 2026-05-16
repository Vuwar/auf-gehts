using Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Deck> Decks => Set<Deck>();
    public DbSet<FlashCard> FlashCards => Set<FlashCard>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Deck>(entity =>
        {
            entity.ToTable("decks");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasDefaultValueSql("gen_random_uuid()");
            entity.Property(e => e.Name).IsRequired();
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("now()");
        });

        modelBuilder.Entity<FlashCard>(entity =>
        {
            entity.ToTable("flashcards");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasDefaultValueSql("gen_random_uuid()");
            entity.Property(e => e.Front).IsRequired();
            entity.Property(e => e.Back).IsRequired();
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("now()");
            entity.HasOne(e => e.Deck)
                  .WithMany(d => d.FlashCards)
                  .HasForeignKey(e => e.DeckId)
                  .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
