<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RecipeType extends Model
{
    protected $table      = 'recipe_types';
    protected $primaryKey = 'recipe_type_id';

    protected $fillable = ['name', 'description'];

    /**
     * Batches that use this recipe type.
     */
    public function inventoryBatches()
    {
        return $this->hasMany(\App\Models\InventoryBatch::class, 'recipe_type_id', 'recipe_type_id');
    }
}
