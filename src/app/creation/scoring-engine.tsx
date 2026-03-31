'use client';

import React from 'react';
import { Slider } from '@/components/ui/slider';
import { Progress, ProgressTrack, ProgressIndicator } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ScoringEngineProps {
  seoScore: number;
  brandScore: number;
  technicalScore: number;
  onSeoChange: (val: number | readonly number[]) => void;
  onBrandChange: (val: number | readonly number[]) => void;
  onTechnicalChange: (val: number | readonly number[]) => void;
}

export function ScoringEngine({
  seoScore,
  brandScore,
  technicalScore,
  onSeoChange,
  onBrandChange,
  onTechnicalChange,
}: ScoringEngineProps) {
  const averageScore = Math.round((seoScore + brandScore + technicalScore) / 3);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'bg-emerald-500';
    if (score >= 50) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  return (
    <Card className="bg-white border-emerald-100">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold text-emerald-900">Scoring Engine</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm font-medium">
              <span>SEO Readiness</span>
              <span>{seoScore}%</span>
            </div>
            <Slider
              value={[seoScore]}
              onValueChange={onSeoChange}
              max={100}
              step={1}
              className="[&_[data-slot=slider-range]]:bg-emerald-600"
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm font-medium">
              <span>Brand Voice</span>
              <span>{brandScore}%</span>
            </div>
            <Slider
              value={[brandScore]}
              onValueChange={onBrandChange}
              max={100}
              step={1}
              className="[&_[data-slot=slider-range]]:bg-emerald-600"
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm font-medium">
              <span>Technical Health</span>
              <span>{technicalScore}%</span>
            </div>
            <Slider
              value={[technicalScore]}
              onValueChange={onTechnicalChange}
              max={100}
              step={1}
              className="[&_[data-slot=slider-range]]:bg-emerald-600"
            />
          </div>
        </div>

        <div className="pt-4 border-t">
          <div className="flex justify-between items-end mb-2">
            <span className="text-sm font-bold text-emerald-900 uppercase tracking-wider">Average Score</span>
            <span className="text-3xl font-black text-emerald-700">{averageScore}%</span>
          </div>
          <Progress value={averageScore} className="h-3 bg-emerald-100">
            <ProgressTrack className="h-3">
              <ProgressIndicator className={cn("h-full transition-all", getScoreColor(averageScore))} />
            </ProgressTrack>
          </Progress>
        </div>
      </CardContent>
    </Card>
  );
}
