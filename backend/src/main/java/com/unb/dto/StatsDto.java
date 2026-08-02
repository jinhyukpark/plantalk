package com.unb.dto;

public class StatsDto {
    private int total;
    private int completed;
    private int declined;
    private int created;
    private int agreed;

    public StatsDto() {}

    public StatsDto(int total, int completed, int declined, int created, int agreed) {
        this.total = total;
        this.completed = completed;
        this.declined = declined;
        this.created = created;
        this.agreed = agreed;
    }

    public int getTotal() { return total; }
    public void setTotal(int total) { this.total = total; }
    public int getCompleted() { return completed; }
    public void setCompleted(int completed) { this.completed = completed; }
    public int getDeclined() { return declined; }
    public void setDeclined(int declined) { this.declined = declined; }
    public int getCreated() { return created; }
    public void setCreated(int created) { this.created = created; }
    public int getAgreed() { return agreed; }
    public void setAgreed(int agreed) { this.agreed = agreed; }
}
